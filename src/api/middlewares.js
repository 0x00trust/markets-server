const { ValidationError } = require('express-validation')
const { utcDate, utcStartOfDay } = require('../utils')
const CurrencyRate = require('../db/models/CurrencyRate')

const dateInterval = (interval, minInterval) => {
  switch (interval) {
    case '1d':
      return {
        dateInterval: minInterval,
        dateFrom: utcDate({ days: -1 }),
        dateTo: utcDate({})
      }
    case '1w':
      return {
        dateInterval: '4h',
        dateFrom: utcDate({ days: -7 }),
        dateTo: utcStartOfDay({})
      }
    case '2w':
      return {
        dateInterval: '8h',
        dateFrom: utcDate({ days: -14 }, 'yyyy-MM-dd'),
        dateTo: utcStartOfDay({})
      }
    case '1m':
      return {
        dateInterval: '1d',
        dateFrom: utcDate({ month: -1 }, 'yyyy-MM-dd'),
        dateTo: utcStartOfDay({})
      }
    case '3m':
      return {
        dateInterval: '1d',
        dateFrom: utcDate({ month: -3 }, 'yyyy-MM-dd'),
        dateTo: utcStartOfDay({})
      }
    case '6m':
      return {
        dateInterval: '1d',
        dateFrom: utcDate({ month: -6 }, 'yyyy-MM-dd'),
        dateTo: utcStartOfDay({})
      }
    case '1y':
      return {
        dateInterval: '1d',
        dateFrom: utcDate({ month: -12 }, 'yyyy-MM-dd'),
        dateTo: utcStartOfDay({})
      }
    case '2y':
      return {
        dateInterval: '1d',
        dateFrom: utcDate({ month: -24 }, 'yyyy-MM-dd'),
        dateTo: utcStartOfDay({})
      }
    case 'all':
      return {
        dateInterval: '1d',
        dateFrom: utcDate({ years: -10 }, 'yyyy-MM-dd'),
        dateTo: utcStartOfDay({})
      }
    default:
      return {
        dateInterval: minInterval,
        dateFrom: utcDate({ days: -1 }),
        dateTo: utcDate({})
      }
  }
}

exports.setCurrencyRate = async (req, res, next) => {

  const record = await CurrencyRate.getCurrencyRate(req.query.currency, req.query.timestamp)
  if (!record || !record.rate) {
    const errors = [{
      currency: 'Wrong currency code'
    }]

    return next(new ValidationError(errors, { statusCode: 400, error: 'Bad Request' }))
  }

  // eslint-disable-next-line no-param-reassign
  req.currencyRate = record.rate

  next()
}

exports.setDateInterval = (req, res, next) => {
  const dateParams = dateInterval(req.query.interval, '30m')

  req.dateInterval = dateParams.dateInterval // eslint-disable-line
  req.dateFrom = dateParams.dateFrom // eslint-disable-line

  next()
}

exports.setDexDateInterval = (req, res, next) => {
  const dateParams = dateInterval(req.query.interval, '1h')

  req.dateInterval = dateParams.dateInterval // eslint-disable-line
  req.dateFrom = dateParams.dateFrom // eslint-disable-line
  req.dateTo = dateParams.dateTo // eslint-disable-line

  next()
}

exports.setMonthlyInterval = (req, res, next) => {
  const dateParams = dateInterval('1m', '1d')

  req.dateInterval = dateParams.dateInterval // eslint-disable-line
  req.dateFrom = dateParams.dateFrom // eslint-disable-line
  req.dateTo = dateParams.dateTo // eslint-disable-line

  next()
}

exports.error404 = (req, res) => {
  res.status(404)
  res.send({
    error: 'Not found'
  })
}

exports.error500 = (err, req, res, next) => {
  console.log(err)

  if (err instanceof ValidationError) {
    res.status(err.statusCode)
    res.json(err)
    return
  }

  res.status(500)

  if (process.env.NODE_ENV === 'development') {
    res.json(err)
  } else {
    res.json({ message: 'Interval Server error' })
  }
}
