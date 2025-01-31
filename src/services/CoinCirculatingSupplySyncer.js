const Syncer = require('./Syncer')
const utils = require('../utils')
const Platform = require('../db/models/Platform')
const defillama = require('../providers/defillama')
const etherscan = require('../providers/etherscan')
const optimistic = require('../providers/etherscan-optimistic')
const arbiscan = require('../providers/arbiscan')
const polygonscan = require('../providers/polygonscan')
const snowtrace = require('../providers/snowtrace')
const tronscan = require('../providers/tronscan')
const bscscan = require('../providers/bscscan')
const solscan = require('../providers/solscan')
const cronoscan = require('../providers/cronoscan')
const ftmscan = require('../providers/ftmscan')
const celoscan = require('../providers/celoscan')

class CoinCirculatingSupplySyncer extends Syncer {

  async sync({ uids, chain }) {
    const map = {}
    const platforms = await Platform.getMarketCap(uids, chain)
    const stablecoins = await defillama.getStablecoins()

    for (let i = 0; i < platforms.length; i += 1) {
      const platform = platforms[i]

      if (!platform.csupply) { // circulation supply from coingecko
        continue
      }

      let supply = platform.csupply
      if (platform.multi_chain_id) {
        supply = await this.getSupply(platform, stablecoins)
        await utils.sleep(100)
      }

      if (supply) {
        map[platform.id] = supply
      }
    }

    await this.update(Object.entries(map))
  }

  async getSupply(platform, stablecoins) {
    const stablecoin = stablecoins[platform.uid]
    if (stablecoin) {
      console.log('Stablecoin supply for', platform.uid, platform.chain_uid, platform.address)
      return stablecoin[platform.chain_uid]
    }

    switch (platform.uid) {
      case 'stepn':
        if (platform.type === 'spl') {
          return platform.csupply
        }
        break
      default:
    }

    let supply
    switch (platform.chain_uid) {
      case 'ethereum':
        supply = await this.fetchSupply(platform, etherscan)
        break
      case 'binance-smart-chain':
        supply = await this.fetchSupply(platform, bscscan)
        break
      case 'optimistic-ethereum':
        supply = await this.fetchSupply(platform, optimistic)
        break
      case 'arbitrum-one':
        supply = await this.fetchSupply(platform, arbiscan)
        break
      case 'polygon-pos':
        supply = await this.fetchSupply(platform, polygonscan)
        break
      case 'avalanche':
        supply = await this.fetchSupply(platform, snowtrace)
        break
      case 'cronos':
        supply = await this.fetchSupply(platform, cronoscan)
        break
      case 'fantom':
        supply = await this.fetchSupply(platform, ftmscan)
        break
      case 'celo':
        supply = await this.fetchSupply(platform, celoscan)
        break
      case 'tron':
        supply = await this.fetchSupplyTron(platform)
        break
      case 'solana':
        supply = await this.fetchSupplySolana(platform)
        break
      case 'binancecoin':
        if (platform.uid !== 'binancecoin') {
          supply = platform.csupply
        }
        break
      default:
    }

    if (supply > platform.csupply) {
      supply = platform.csupply
    }

    // if (supply === undefined) {
    //   supply = platform.csupply
    // }

    return supply
  }

  async fetchSupply(platform, provider) {
    if (!platform.decimals || !platform.address) {
      return null
    }

    const supply = await provider.getTokenSupply(platform.address)
    if (supply) {
      return supply / (10 ** platform.decimals)
    }
  }

  async fetchSupplyTron(platform) {
    if (!platform.address) {
      return null
    }

    const token = await tronscan.getTokenInfo(platform.address)
    if (!token) {
      return null
    }

    if (token.total_supply_with_decimals && token.decimals) {
      return token.total_supply_with_decimals / (10 ** token.decimals)
    }

    return null
  }

  async fetchSupplySolana(platform) {
    if (!platform.address) {
      return null
    }

    const token = await solscan.getTokenInfo(platform.address)
    if (!token || !token.decimals || !token.supply) {
      return null
    }

    return token.supply / 10 ** token.decimals
  }

  update(values) {
    return Platform.updateCSupplies(values)
      .then(() => {
        console.log('Updated platforms circulating supplies')
      })
      .catch(e => {
        console.log(e)
      })
  }

}

module.exports = CoinCirculatingSupplySyncer
