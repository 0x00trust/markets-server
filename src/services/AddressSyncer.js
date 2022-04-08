/* eslint-disable no-param-reassign */
const { chunk } = require('lodash')
const { DateTime } = require('luxon')
const { sleep } = require('../utils')
const { bitquery } = require('../providers/bitquery')
const bigquery = require('../providers/bigquery')
const Platform = require('../db/models/Platform')
const Address = require('../db/models/Address')
const Syncer = require('./Syncer')

class AddressSyncer extends Syncer {
  constructor() {
    super()
    this.BUSDT_ADDRESS = '0x55d398326f99059ff775485246999027b3197955'
  }

  async start() {
    await this.syncHistorical()
    await this.syncLatest()
  }

  async syncHistorical() {
    if (!await Address.existsForPlatforms(['ethereum', 'erc20'])) {
      await this.syncStatsFromBigquery(this.syncParamsHistorical('1d'), '1d')
      await this.syncStatsFromBigquery(this.syncParamsHistorical('30m'), '30m')
    }

    if (!await Address.existsForPlatforms(['bitcoin'])) {
      await this.syncStatsFromBigquery(this.syncParamsHistorical('1d'), '1d', true)
      await this.syncStatsFromBigquery(this.syncParamsHistorical('30m'), '30m', true)
    }

    if (!await Address.existsForPlatforms(['bep20'])) {
      await this.syncHistoricalStatsFromBitquery(this.syncParamsHistorical('1d'), 'bsc')
    }

    if (!await Address.existsForPlatforms(['solana'])) {
      await this.syncHistoricalStatsFromBitquery(this.syncParamsHistorical('1d'), 'solana')
    }
  }

  async syncLatest() {
    this.cron('30m', this.syncDailyStats)
    this.cron('1d', this.syncMonthlyStats)
  }

  async syncDailyStats(dateParams) {
    await this.adjustPoints(dateParams.dateFrom, dateParams.dateTo)

    await this.syncStatsFromBigquery(dateParams, '30m')
    await this.syncStatsFromBigquery(dateParams, '30m', true)
    await this.syncStatsFromBitquery(dateParams, 'bsc', true)
    await this.syncStatsFromBitquery(dateParams, 'solana', true)
  }

  async syncMonthlyStats(dateParams) {
    await this.adjustPoints(dateParams.dateFrom, dateParams.dateTo)
  }

  async adjustPoints(dateFrom, dateTo) {
    await Address.updatePoints(dateFrom, dateTo)
    await Address.deleteExpired(dateFrom, dateTo)
  }

  async syncStatsFromBigquery({ dateFrom, dateTo }, timePeriod, syncBtcBaseCoins = false) {
    try {
      const types = ['bitcoin', 'bitcoin-cash', 'dash', 'dogecoin', 'litecoin', 'zcash', 'ethereum', 'erc20']
      const platforms = await this.getPlatforms(types, true, false)

      const addressStats = syncBtcBaseCoins
        ? await bigquery.getAddressStatsBtcBased(dateFrom, dateTo, timePeriod)
        : await bigquery.getAddressStats(platforms.list, dateFrom, dateTo, timePeriod)

      const records = addressStats.map(data => ({
        count: data.address_count,
        date: data.block_date.value,
        platform_id: platforms.map[data.coin_address || data.platform]
      }))

      await this.upsertAddressStats(records)
    } catch (e) {
      console.log('Error syncing address stats', e)
    }
  }

  async syncHistoricalStatsFromBitquery(dateParams, network) {
    console.log('Start syncing historical address stats for network', network)

    const dateFromStart = DateTime.fromSQL(dateParams.dateFrom)
    let dateTo = DateTime.utc()

    while (dateFromStart <= dateTo) {
      const dateFrom = dateTo.minus({ days: 1 })

      console.log(`Syncing historical address stats for ${dateFrom} -> ${dateTo}`)

      await this.syncStatsFromBitquery({
        dateFrom: dateFrom.toFormat('yyyy-MM-dd 00:00:00Z'),
        dateTo: dateTo.toFormat('yyyy-MM-dd 00:00:00Z')
      }, network, 50)

      dateTo = dateFrom
    }
  }

  async syncStatsFromBitquery({ dateFrom, dateTo }, network, chunkSize = 20) {
    try {
      const platforms = await this.getPlatforms(network === 'bsc' ? 'bep20' : network)
      const addressStats = []
      const isoDateFrom = DateTime.fromFormat(dateFrom, 'yyyy-MM-dd HH:mm:00Z').toString()
      const isoDateTo = DateTime.fromFormat(dateTo, 'yyyy-MM-dd HH:mm:00Z').toString()
      const chunks = this.getChunks(platforms.list, chunkSize)

      for (let i = 0; i < chunks.length; i += 1) {
        console.log(`Fetching address stats for chunks: ${i + 1}/${chunks[i].length}`)

        const transfersSenders = await bitquery.getTransferSenders(isoDateFrom, isoDateTo, chunks[i], network)
        const transferReceivers = await bitquery.getTransferReceivers(isoDateFrom, isoDateTo, chunks[i], network)

        const transfers = [...transfersSenders, ...transferReceivers]
        const transfersMap = transfers.reduce((map, { account, currency }) => {
          const mapElement = map[currency.address]

          if (!mapElement) {
            map[currency.address] = [account.address]
          } else if (!mapElement.find(t => t === account.address)) {
            map[currency.address] = [...[account.address], ...mapElement]
          }

          return map
        }, {})

        Object.keys(transfersMap).forEach(coinAddress => {
          addressStats.push({
            date: dateTo,
            count: transfersMap[coinAddress].length,
            platform_id: platforms.map[coinAddress]
          })
        })

        await sleep(4000) // wait to bypass API limits
      }

      await this.upsertAddressStats(addressStats)
      console.log('Successfully synced address stats for date', dateTo)
    } catch (e) {
      console.log('Error syncing address stats', e)
    }
  }

  getChunks(platforms, chunkSize) {
    const newList = platforms.filter(item => item.address !== this.BUSDT_ADDRESS)
    return [...[[{ address: this.BUSDT_ADDRESS }]], ...chunk(newList, chunkSize)]
  }

  async getPlatforms(types, withDecimals, withAddress = true) {
    const chains = ['bitcoin', 'ethereum', 'bitcoin-cash', 'dash', 'dogecoin', 'litecoin', 'zcash']
    const platforms = await Platform.getByTypes(types, withDecimals, withAddress)
    const map = {}
    const list = []

    platforms.forEach(({ type, address, decimals, id }) => {
      if (chains.includes(type)) {
        map[type] = id
      }

      if (address) {
        map[address] = id

        if (!withDecimals) {
          list.push({ address })
        } else if (decimals) {
          list.push({ address, decimals })
        }
      }
    })

    return { list, map }
  }

  async upsertAddressStats(records) {
    const items = records.filter(item => item.platform_id)
    if (!items.length) {
      return
    }

    const chunks = chunk(items, 400000)

    for (let i = 0; i < chunks.length; i += 1) {
      await Address.bulkCreate(chunks[i], { updateOnDuplicate: ['count', 'date', 'platform_id'] })
        .then((data) => {
          console.log('Inserted address stats', data.length)
        })
        .catch(err => {
          console.error(err)
        })
    }
  }
}

module.exports = AddressSyncer
