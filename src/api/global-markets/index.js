const express = require('express')
const controller = require('./global-markets.controller')
const { setCurrencyRate } = require('../middlewares')
const { validateGlobalMarkets } = require('./global-markets.validator')

const router = express.Router()

/**
 * @api {get} /v1/global-markets List global-markets
 * @apiDescription Get a list of global markets data
 * @apiVersion 1.0.0
 * @apiGroup GlobalMarket
 *
 * @apiParam    {String=1d,7d,30d}  interval    Date interval
 * @apiUse      Currencies
 *
 * @apiSuccessExample {json} Success-Response:
 *  HTTP/1.1 200 OK
 *  [{
 *    "date": 1636502400,
 *    "market_cap": "3047998518216.157",
 *    "defi_market_cap": "172072403231",
 *    "volume": "176631891823.3525",
 *    "btc_dominance": "41.6",
 *    "tvl": "272469732222.98926"
 *  }]
 */
router.get('/', validateGlobalMarkets, setCurrencyRate, controller.index)

/**
 * @api {get} /v1/global-markets List chain tvls
 * @apiDescription Get a list of global chain tvls
 * @apiVersion 1.0.0
 * @apiGroup GlobalMarket
 *
 * @apiParam    {String=1d,7d,30d}  interval    Date interval
 * @apiUse      Currencies
 *
 * @apiSuccessExample {json} Success-Response:
 *  HTTP/1.1 200 OK
 *  [{
 *    "date": 1636502400,
 *    "tvl": "272469732222.98926"
 *  }]
 */

router.get('/:chain/tvls', validateGlobalMarkets, setCurrencyRate, controller.tvls)

module.exports = router
