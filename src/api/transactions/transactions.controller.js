const Transaction = require('../../db/models/Transaction')
const DexLiquidity = require('../../db/models/DexLiquidity')
const DexVolume = require('../../db/models/DexVolume')
const serializer = require('./transactions.serializer')
const { utcDate } = require('../../utils')

exports.index = async ({ query, dateFrom, dateTo, dateInterval }, res) => {
  const transactions = await Transaction.getByCoin(query.coin_uid, query.platform, dateInterval, dateFrom, dateTo)
  res.send(serializer.serializeTransactions(transactions))
}

exports.dexVolume = async ({ query, dateFrom, dateTo, dateInterval, currencyRate }, res) => {
  const dexVolume = await DexVolume.getByCoin(query.coin_uid, query.platform, dateInterval, dateFrom, dateTo)
  res.send(serializer.serializeDexVolumes(dexVolume, currencyRate))
}

exports.dexLiquidity = async ({ query, dateFrom, dateInterval, currencyRate }, res) => {
  const dexLiquidity = await DexLiquidity.getByCoin(query.coin_uid, query.platform, dateInterval, dateFrom, utcDate({}))
  res.send(serializer.serializeDexLiquidity(dexLiquidity, currencyRate))
}
