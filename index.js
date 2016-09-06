const { send, json } = require('micro');
const url = require('url');
const axios = require('axios');

module.exports = async function (req, res) {
	const query = url.parse(req.url, true).query;
	if(!query.q){
		send(res, 422, {
			"message": 'missing query string'
		});
		return;
	}
	const { data } = await axios.get(`http://completion.amazon.com/search/complete?method=completion&q=${query.q}&search-alias=stripbooks&client=amazon-search-ui&mkt=1`)
	send(res, 200, data[1]);
}