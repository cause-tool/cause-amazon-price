'use strict';

var validator = require('validator');
var _ = require('lodash');
var request = require('request');
var scrapingUtils = require('cause-utils/dist/scraping');
var formattingUtils = require('cause-utils/dist/formatting');

function main(step, context, config, input, done) {
	// validation
	if (!validator.isURL(config.url)) {
		throw new Error('not a valid url: ' + config.url);
	}

	var reqOpts = _.defaults({ url: config.url }, scrapingUtils.requestDefaults());
	reqOpts.headers = _.merge(reqOpts.headers, {
		'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
		'Accept-Language': 'en-US,en;q=0.8,de;q=0.6',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
		'DNT': '1',
		'Pragma': 'no-cache',
		'Referer': 'http://www.amazon.com'
	});

	request(reqOpts, function (err, res, body) {
		if (err) {
			return done(err);
		}

		var $selection = scrapingUtils.query('css', '#priceblock_ourprice', body);

		var msg = void 0;
		if (!$selection) {
			msg = 'scraping failed';
			context.logger.error(formattingUtils.taskMsg(context.task.name, msg));
			return done(new Error(msg));
		}

		if ($selection.length === 0) {
			msg = 'selection is empty';
			context.logger.error(formattingUtils.taskMsg(context.task.name, msg));
			return done(new Error(msg));
		}

		if ($selection.length > 1) {
			msg = 'more than one element selected — only using first one';
			context.logger.warn(formattingUtils.taskMsg(context.task.name, msg));
		}

		var text = $selection.first().text();
		var priceStr = formattingUtils.price(text, config);
		var price = parseFloat(priceStr);
		if (_.isNaN(price)) {
			msg = 'could not parse price: ' + priceStr;
			context.logger.error(formattingUtils.taskMsg(context.task.name, msg));
			return done(new Error(msg));
		}

		var output = price;
		var priceDidChange = step.data.prevPrice !== price;

		// custom logging
		if (priceDidChange) {
			context.logger.info(formattingUtils.priceDelta(price, step.data.prevPrice, context.task));
		}

		step.data.prevPrice = price;
		context.saveTask();

		done(null, output, priceDidChange);
	}).on('error', function (err) {
		done(err);
	});
}

module.exports = {
	main: main,
	defaults: {
		config: {
			currency: 'EUR'
		},
		data: {
			prevPrice: 0
		},
		description: 'amazon product\nprice changed'
	}
};