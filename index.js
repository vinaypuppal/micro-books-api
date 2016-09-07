const { send } = require('micro');
const HttpHash = require('http-hash');
const Piranhax = require('piranhax');
const url = require('url');
const axios = require('axios');

const CLIENT_ID = process.env.CLIENT_ID;
const SECRET = process.env.SECRET;
const ASSOCIATE_ID = process.env.ASSOCIATE_ID;

const hash = HttpHash();
const Amazon = new Piranhax(CLIENT_ID, SECRET, ASSOCIATE_ID);

// create path /books and specify what we can do
hash.set('GET /books', async function autocompleteBooks(req, res, params) {
	const result = {
		'api_endpoints': {
			search: {
				endpoint: '/books/search',
				'required_query_fields': ["q", "locale"],
				'optional_query_fields': ["page"],
				'example_request': '/books/search?q=html&locale=in',
				info: '"q" is search term to be searched, "locale" is country code like IN or US,"page" is page number ranging from 1 to 10 only',
			},
			price: {
				endpoint: '/books/price',
				'required_query_fields': ["q", "locale"],
				info: '"q" is ASIN of book to get price',
				'example_request': '/books/search?q=0070701946&locale=in'
			},
			autocomplete: {
				endpoint: '/books/autocomplete',
				'required_query_fields': ["q"],
				info: '"q" is search character to get suggestions',
				'example_request': '/books/autocomplete?q=h'
			}
		}
	}
	send(res, 200, result);
});

// create path for /books/search to search books
// and check if query parameters are passed if not throw error
// it requires q, locale, [page] as query fields
hash.set('GET /books/search', async function autocompleteBooks(req, res, params) {
	const query = url.parse(req.url,true).query;
	if (!query.q) {
		send(res, 422, {
				message: "field q missing in query"
		});
	} else if (!query.locale) {
		send(res, 422, {
				message: "field locale missing in query"
		});
	} else {
		const keywords = query.q;
		const locale = query.locale.toUpperCase();
		const page = query.page || 1;
		if(~~page > 10){
			send(res, 422, {
				message: "The value you specified for page is invalid. Valid values must be between 1 and 10"
			});
		}
		Amazon.setLocale(locale);
		try{
		const books = await Amazon.ItemSearch("Books", {
																						    Keywords: keywords,
																						    ItemPage: page,
																						    Sort: 'relevancerank',
																						    Power: 'paperback',
																						    ResponseGroup: ['Images','ItemAttributes','EditorialReview','Offers','OfferListings']
																						    });
		const data = books.data();
		const result = {};
		if(data.error){
			result.is_valid = false;
			result.error = {
				message: 'Request is invalid',
				details: data.error,
			};
			send(res, 400, result);
		}
		result.is_valid = data.Request && data.Request.IsValid && true;
		result.current_page = data.Request.ItemSearchRequest.ItemPage;
		result.total_results = data.TotalResults;
		result.total_pages = data.TotalPages;
		if ( data.Item instanceof Array ) {
			result.items = data.Item.map((book) => {
				return {
					ASIN: book.ASIN,
					large_image_url: book.LargeImage && book.LargeImage.URL || 'http://g-ecx.images-amazon.com/images/G/31/x-site/icons/no-img-lg._V138359931_BO1,204,203,200_.gif',
          medium_image_url: book.MediumImage && book.MediumImage.URL || 'http://g-ecx.images-amazon.com/images/G/31/x-site/icons/no-img-lg._V138359931_BO1,204,203,200_.gif',
          title: book.ItemAttributes && book.ItemAttributes.Title || 'N/A',
          author: book.ItemAttributes && book.ItemAttributes.Author || 'N/A',
          publisher: book.ItemAttributes && book.ItemAttributes.Publisher || 'N/A',
          offerListing : book.Offers && book.Offers.Offer && book.Offers.Offer.OfferListing,
          description_html: book.EditorialReviews && book.EditorialReviews.EditorialReview.content,
				};
			}).filter((book)=>{return book.offerListing});
		} else {
			const book = booksResults.Item;
			const item = {
				ASIN: book.ASIN,
				large_image_url: book.LargeImage && book.LargeImage.URL || 'http://g-ecx.images-amazon.com/images/G/31/x-site/icons/no-img-lg._V138359931_BO1,204,203,200_.gif',
        medium_image_url: book.MediumImage && book.MediumImage.URL || 'http://g-ecx.images-amazon.com/images/G/31/x-site/icons/no-img-lg._V138359931_BO1,204,203,200_.gif',
        title: book.ItemAttributes && book.ItemAttributes.Title || 'N/A',
        author: book.ItemAttributes && book.ItemAttributes.Author || 'N/A',
        publisher: book.ItemAttributes && book.ItemAttributes.Publisher || 'N/A',
        offerListing : book.Offers && book.Offers.Offer && book.Offers.Offer.OfferListing,
        description_html: book.EditorialReviews && book.EditorialReviews.EditorialReview.content,
			};
			result.items = [item];
		}
		send(res, 200, result);
		} catch(e){
			send(res, 500, { error: e.message })
		}
	}
});

// create path for /books/price to get price
// about particular book
// it requires ASIN as query field "q"
hash.set('GET /books/price', async function autocompleteBooks(req, res, params){
	const query = url.parse(req.url,true).query;
	if(!query.q){
		send(res, 422, {
				message: "field q missing in query"
		});
	} else if (!query.locale) {
		send(res, 422, {
				message: "field locale missing in query"
		});
	} else {
		const ASIN = query.q;
		const locale = query.locale.toUpperCase();
		Amazon.setLocale(locale);
		const book = await Amazon.ItemLookup(ASIN, {
        ResponseGroup: ['Offers','OfferListings']
    });
		const data = book.data();
		const result = {};
		if(data.error){
			result.is_valid = false;
			result.error = {
				message: 'Request is invalid',
				details: data.error,
			};
			send(res, 400, result);
		}
		result.is_valid = data.Request && data.Request.IsValid && true;
		result.price = data.Item.Offers && data.Item.Offers.Offer && data.Item.Offers.Offer.OfferListing && data.Item.Offers.Offer.OfferListing.Price;
		result.sale_price = data.Item.Offers && data.Item.Offers.Offer && data.Item.Offers.Offer.OfferListing && data.Item.Offers.Offer.OfferListing.SalePrice;
		result.price = {
			amount: result.price.Amount,
			currency_code: result.price.CurrencyCode,
			formatted_price: result.price.FormattedPrice,
		};
		if(result.sale_price){
			result.sale_price = {
				amount: result.sale_price.Amount,
				currency_code: result.sale_price.CurrencyCode,
				formatted_price: result.sale_price.FormattedPrice,
			};
		}
		send(res, 200, result);
	}
});

// create path for /books/autocomplete
// to get suggestion in search bar
// it requires searchterm as query field "q"
hash.set('GET /books/autocomplete', async function autocompleteBooks(req, res, params){
	const query = url.parse(req.url,true).query;
	if(!query.q){
		send(res, 422, {
				message: "field q missing in query"
		});
	} else {
		const { data } = await axios.get(`https://completion.amazon.com/search/complete?method=completion&q=${query.q}&search-alias=stripbooks&client=amazon-search-ui&mkt=1`);
		send(res, 200, data[1]);
	}
});

module.exports = async function (req, res) {
	const { method } = req
	const { pathname } = url.parse(req.url,true);
	console.log('pathname', pathname);
  const match = hash.get(`${method.toUpperCase()} ${pathname}`)
  console.log('match', match);
  if (match.handler) {
    try {
      await match.handler(req, res, match.params);
    } catch (e) {
      send(res, 500, { message: e.message });
    }
  } else {
    send(res, 404, { message: 'route not found' });
  }
}