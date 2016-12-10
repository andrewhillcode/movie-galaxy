var express = require('express');
var https = require('https');
var config = require('./config')

var app = express();

app.use(express.static(__dirname));

const port = process.env.PORT || 3000;

var guideboxCredentials = {
	//grabs streaming/hire/download links
	api_key: config.guideboxKey,
	//example url https://api-public.guidebox.com/v1.43/AU/rK4UsP1iBNnSALecLAZsPj3cBWax4xFd/movie/92768
};

var tmdbCredentials = {
	//grabs initial movie list / actor list sorted by popularity
	api_key: config.tmdbKey,
	//example url http://api.themoviedb.org/3/discover/movie?api_key=4f76e7108cafedc154990c7356e22440&primary_release_year=2010&sort_by=popularity.desc&page=1
};


function getOMDBData(rsp, callback){
	//initialize counter
	var counter = 0; 

	//loop through results 
 	for (var i=0; i < rsp.results.length; i++) {
		movie = rsp.results[i];

		movie.order = i;

		movie.searchtitle = movie.title.split('-').join('');
		movie.searchtitle = movie.title.split('–').join('');
		movie.searchtitle = movie.searchtitle.split(' ').join('+');

		//get the year from the date string
		movie.release_date = movie.release_date.substring(0, 4);

		callOMDBAPI(movie, function(movie){
			counter++;
			//when all requests are done, callback
		 	if (counter == rsp.results.length){
		 		callback(rsp);
		 	}
		});
	}
}

function callOMDBAPI(movie, callback){
	var options = {
		hostname: 'omdbapi.com',
		port: 443,
		path: '/?',
		method: 'GET'
	}

	//create OMDB search string
	var s = '&t=' + movie.searchtitle + '&y=' + movie.release_date + '&tomatoes=true';
	options.path += s;

	var omdbReq = https.request(options, function(omdbRes) {
		 var body = [];
		 omdbRes.on('data',function(chunk) {
			 body.push(chunk);
		 });

		omdbRes.on('end', function() {
			var bodyString = body.join('');
			var omdbRsp = JSON.parse(bodyString);
	
			//add omdb data to the result set
			movie.plot = omdbRsp.Plot;
			movie.tomatoConsensus = omdbRsp.tomatoConsensus;
			movie.director = omdbRsp.Director;
			movie.tomatoMeter = omdbRsp.tomatoMeter;
			movie.tomatoURL = omdbRsp.tomatoURL;
			movie.actors = omdbRsp.Actors;
			movie.runtime = omdbRsp.Runtime;
			movie.year = omdbRsp.Year;
			movie.imdbID = omdbRsp.imdbID;
			movie.tomatoImage = omdbRsp.tomatoImage;

			callback(movie);
		});

	});

	omdbReq.on('error', (e) => {
		console.error(e);
	});

	omdbReq.end();
}


function getGuideboxData(rsp, callback){
	//initialize counter
	var counter = 0;

	for (var i=0; i < rsp.results.length; i++) {
		movie = rsp.results[i];

		callGuideboxAPI_ID(movie, function(movie){
			//when we have the ID, get the rest of the data
		 	callGuideboxAPI_Data(movie, function(movie){
			 	counter++;
				//when all requests are done, callback
			 	if (counter == rsp.results.length){
			 		callback(rsp);
			 	}


		 	});
		});
	}
}


function callGuideboxAPI_ID(movie, callback){
	var options = {
		hostname: 'api-public.guidebox.com',
		port: 443,
		path: '/v1.43/AU/',
		method: 'GET'
	}

	//create Guidebox search string
	var s = guideboxCredentials.api_key + "/search/movie/id/imdb/" + movie.imdbID;
	options.path += s;

	var guideboxReq = https.request(options, function(guideboxRes) {
		var body = [];
		guideboxRes.on('data',function(chunk) {
			body.push(chunk);
		});

		guideboxRes.on('end', function() {
			var bodyString = body.join('');
			var guideboxRsp = JSON.parse(bodyString);
	
			//store id
			movie.guideboxID = guideboxRsp.id;

			callback(movie);
		});

	});

	guideboxReq.on('error', (e) => {
		console.error(e);
	});
	guideboxReq.end();
}

function callGuideboxAPI_Data(movie, callback){
	var options = {
		hostname: 'api-public.guidebox.com',
		port: 443,
		path: '/v1.43/AU/',
		method: 'GET'
	}

	//create Guidebox search string
	var s = guideboxCredentials.api_key + "/movie/" + movie.guideboxID;
	options.path += s;

	var guideboxReq = https.request(options, function(guideboxRes) {
		 var body = [];
		 guideboxRes.on('data',function(chunk) {
			 body.push(chunk);
		 });

		guideboxRes.on('end', function() {
			var bodyString = body.join('');
			var guideboxRsp = JSON.parse(bodyString);
	
			//if we have the id
			if(guideboxRsp.id){
				//if there are any web sources
				if(guideboxRsp.purchase_web_sources.length > 0){
					movie.buy = guideboxRsp.purchase_web_sources[0]['link'];
					movie.buy_source = guideboxRsp.purchase_web_sources[0]['display_name'];
				}
				//if there are any trailers
				if(guideboxRsp.trailers.web.length > 0){
					movie.trailer = guideboxRsp.trailers.web[0]['embed'];
				} else {
					movie.trailer = null;
				}
			}

			callback(movie);
		});

	});

	guideboxReq.on('error', (e) => {
		console.error(e);
	});
	guideboxReq.end();
}		

function createPage(title,rsp,callback){
	//write <head> to str
	var str = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN""http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">'
	+ '<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en"lang="en"><head><title>Movie Galaxy</title>'
	+ '<meta charset="UTF-8">'
	+ '<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css">'
	+ '<link href="/style.css" rel="stylesheet" type="text/css"/>'
	+ '<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.3/jquery.min.js"></script>' 
	+ '<script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js"></script>' + '</head>' +
	'<body>';

	//begin writing the content
	str += '<div class="header">';
		str += '<div class="container">';
		 	str += '<a href="../"><img src="/img/logo-small.png"></a>';
			str += '<a class="btn btn-info return-button" href="../">Back to home</a>';
		str += '</div>';
	str += '</div>';
	str += '<div class="container content">';
		str += '<h1 class="title">' + title + '</h1>';
			str += '<hr>';

		//get OMDB data
	getOMDBData(rsp, function(rsp){
		//once we have OMDB data, get Guidebox data
	 	getGuideboxData(rsp, function(rsp){
	 		//once we have all the data, add the rest of the content to str
			finishPage(rsp, str, function(str){
				//once string is finished, callback
				callback(str);
			}) 

		});
	 });
}


function finishPage(rsp, str, callback){
	for (var i=0; i < rsp.results.length; i++) {
		movie = rsp.results[i];

		//if poster doesn't exist
		if(!movie.poster_path || movie.poster_path == 'N/A'){
		 	movie.poster = "<img class='poster' src='/img/notfound.jpg'>";
		} else {
			movie.poster = "<img class='poster' src='https://image.tmdb.org/t/p/w300_and_h450_bestv2/" + movie.poster_path + "'>";
		}
		 
		//create a container for the movie  
	 	str += '<div class="mvcontainer">';
	 		str += '<div class="row">';
		 		str += '<div class="poster-container col-md-3">';
		 			str += movie.poster;
		 		str += '</div>';
		 		str += '<div class="details-container col-md-9">';
		 			if (movie.year == undefined){
		 				movie.year = 'unknown';
		 			}
		 			str += '<h2>' + movie.title + " <span class='year'> (" + movie.year + ")</span>" 
		 			+ '<form class="similar-form" action="/similar" method="GET"><input type="hidden" name="id" value="' + movie.id + '">'
		 			+ '<input type="hidden" name="t" value="' + movie.title + '">'
		 			+ '<button type="submit" tabindex="8" class="form-control btn btn-info">'
		 			+ '<span class="glyphicon glyphicon-search" aria-hidden="true"></span> Similar Movies'
		 			+ '</button>'
		 			+ '</form>'
		 			+ '</h2>';


					str += '<ul class="nav nav-tabs" role="tablist">';
					    str += '<li role="presentation" class="active"><a href="#details' + movie.order + '" aria-controls="detail" role="tab" data-toggle="tab" aria-expanded="true">Details</a></li>';
					    str += '<li role="presentation"><a href="#trailer' + movie.order + '" aria-controls="trailer" role="tab" data-toggle="tab" aria-expanded="false">Trailer</a></li>';
					str += '</ul>';

					str += '<div class="tab-content">';
						str += '<div role="tabpanel" class="tab-pane fade in active details-tab" id="details' + movie.order + '">';
							//if there is no movie data
							if (movie.director == undefined && movie.actors == undefined && movie.runtime == undefined && movie.plot == undefined){
							 	str += 'Could not retrieve movie data.';
							} else { 
							 	str += "<b>Directed by: </b>" + movie.director 
							  	+ "<br>" + "<b>Cast: </b>" + movie.actors 
							  	+ "<br>" + "<b>Runtime: </b>" + movie.runtime 
					 			+ '<p> <b>Synopsis: </b>' + movie.plot + '</p>';
					 		}
					 		
					 		//add a separator between sections
					 		str += '<hr>';

					 		//display the correct image depending on RT score
					 		if (movie.tomatoImage == 'certified' || movie.tomatoImage == 'fresh'){
					 			str += '<p>' + '<img src="/img/tomato.png" alt="fresh"> ' + movie.tomatoMeter + "% - " + movie.tomatoConsensus + '</p>';
					 		} else if (movie.tomatoImage == 'rotten') {
					 			str += '<p>' + '<img src="/img/rotten.png" alt="rotten"> ' + movie.tomatoMeter + "% - " + movie.tomatoConsensus + '</p>';
					 		} else {
					 			str += '<p>' + 'Could not retrieve Tomatometer and critic consensus data. ' + '</p>';
					 		}

					 		//add a separator between sections
				 			str += '<hr>';

				 			//if there is a link to buy the movie
					 		if(movie.buy){
					 			str += '<b>Watch it now: </b>';
					 			str += '<a class="btn btn-success" href="' + movie.buy + '">' + movie.buy_source + '</a>';
					 		}

					 		str += '<div class="buy-movie">';
						 		str += '<b>External Links: </b>';
						 		if(movie.imdbID == undefined){
						 			str += 'No links could be found.';
						 		} else {
						 			str += '<a class="btn btn-primary" href="http://www.imdb.com/title/' + movie.imdbID + '">imdb</a>';
						 		}
						 		if(movie.tomatoURL != 'N/A' && movie.tomatoURL != undefined){
							 		str += '  ';
							 		str += '<a class="btn btn-primary" href="' + movie.tomatoURL + '">Rotten Tomatoes</a>';
							 	}
					 		str += '</div>'; //end external links
						str += '</div>'; //end details tab

						str += '<div role="tabpanel" class="tab-pane fade" id="trailer' + movie.order + '">';
						  	  	if (movie.trailer){
					 				movie.trailer = movie.trailer.substring(4);
					 				str += '<iframe width="640" height="360" src="https' + movie.trailer + '"frameborder="0" allowfullscreen></iframe>';
						  	  	} else {
						  	  		str += 'Sorry. No trailer can be found for this movie.';
						  	  	}
						str += '</div>'; //end trailer tab
		 			str += '</div>'; //end tab-content
	 			str += '</div>'; //end column
		 	str += "</div>"; //end row
	 	str += '</div>'; //end mvcontainer

	 	//add a separator between movies
		str += '<hr class="separator">';
	 }

		str += "<div class='footer'>";
			str += "<hr>";
		str += "<a class='btn btn-info' href='../'>Search Again?</a> <br>";
		str += "<hr>";
		 	str += "API Mashup by Andrew Hill <br> CAB432 [Cloud Computing] QUT 2016 Semester 2";
		 	str += "<br> APIs used: <a href='https://www.themoviedb.org/documentation/api'>themoviedb.org</a> | <a href='http://www.omdbapi.com/'>omdbapi.com</a> | <a href='https://api.guidebox.com/'>guidebox.com</a>";
		str += "</div>"; //end footer

	str += '</body></html>'; //end body and html

	callback(str);
}

function getGenreName(genre, callback){

		var options = {
			hostname: 'api.themoviedb.org',
			port: 443,
			path: '/3/genre/movie/list?',
			method: 'GET'
		}

		var s = 'api_key=' + tmdbCredentials.api_key;
			options.path += s;


		var genreReq = https.request(options, function(genreRes) {
			var body = [];
			genreRes.on('data',function(chunk) {
				 body.push(chunk);
			});

			genreRes.on('end', function() {
				var bodyString = body.join('');
				var rsp = JSON.parse(bodyString);

				//interate through genrelist to find the correct name
				for (i = 0; i < rsp.genres.length; i++){
					if (genre == rsp.genres[i]['id']){
						var name = rsp.genres[i]['name'];
						callback(name);
					}
				}				
			});
		});

		genreReq.on('error', (e) => {
			console.error(e);
		});

		genreReq.end();
}

app.get('/search', function (appReq, appRes) {
	
	function createTMDBOptions(tmdbCredentials, genre) {
		var options = {
			hostname: 'api.themoviedb.org',
			port: 443,
			path: '/3/discover/movie?',
			method: 'GET'
		}

		//find movies with the chosen genre that are in English - sort by popularity highest to lowest
		var s = 'api_key=' + tmdbCredentials.api_key +
			'&with_genres=' + genre +
			'&sort_by=popularity.desc' +
			'&language=en';
			options.path += s;
		return options;
	}

	var tmdbOptions = createTMDBOptions(tmdbCredentials,appReq.query['genre']);

	var tmdbReq = https.request(tmdbOptions, function(tmdbRes) {
		var body = [];
		tmdbRes.on('data',function(chunk) {
			body.push(chunk);
		});

		tmdbRes.on('end', function() {
			var bodyString = body.join('');
			var rsp = JSON.parse(bodyString);
			
			//get the name of the genre to display on the next page
			getGenreName(appReq.query['genre'], function(name){
				var title = "Most popular " + name + " movies";
				createPage(title,rsp, function(str){
					//write string and end
					appRes.writeHead(200,{'content-type': 'text/html'});
					appRes.write(str);
					appRes.end();
				});
			});
		});
	});

	tmdbReq.on('error', (e) => {
		console.error(e);
	});

	tmdbReq.end();
});

app.get('/exact', function (appReq, appRes) {
	
	function createTMDBOptions(tmdbCredentials, query) {

		var options = {
			hostname: 'api.themoviedb.org',
			port: 443,
			path: '/3/search/movie?',
			method: 'GET'
		}

		//find movies that match the query that are in English
		var s = 'api_key=' + tmdbCredentials.api_key +
			'&query=' + query +
			'&language=en';
			options.path += s;
		return options;
	}

	//prepare the query
	query = appReq.query['query'].split(' ').join('+');

	var tmdbOptions = createTMDBOptions(tmdbCredentials,query);

	var tmdbReq = https.request(tmdbOptions, function(tmdbRes) {
		var body = [];
		tmdbRes.on('data',function(chunk) {
			body.push(chunk);
		});

		tmdbRes.on('end', function() {
			var bodyString = body.join('');
			var rsp = JSON.parse(bodyString);
			
			//if there is a response
			if (rsp.results != undefined){
				//if there were any matches
				if (rsp.results.length > 0){
					title = "Search result for: " + appReq.query['query'];
					createPage(title,rsp, function(str){
						//write string and end
						appRes.writeHead(200,{'content-type': 'text/html'});
						appRes.write(str);
						appRes.end();
					});
				} else {
					//redirect with no matches identifier
					var string = encodeURIComponent('1');
					appRes.redirect('/?invalid=' + string);
					appRes.end();
				}
			} else {
				//redirect with empty identifier
				var string = encodeURIComponent('1');
				appRes.redirect('/?empty=' + string);
				appRes.end();
			}	
		});
	});

	tmdbReq.on('error', (e) => {
		console.error(e);
	});

	tmdbReq.end();
});


app.get('/similar', function (appReq, appRes) {
	
	function createTMDBSimilarOptions(tmdbCredentials, id) {

		var options = {
			hostname: 'api.themoviedb.org',
			port: 443,
			path: '/3/movie/',
			method: 'GET'
		}

		var s = id + "/similar?" +
		'api_key=' + tmdbCredentials.api_key;
			
			options.path += s;
		return options;
	}

	var tmdbOptions = createTMDBSimilarOptions(tmdbCredentials,appReq.query['id']);

	var tmdbReq = https.request(tmdbOptions, function(tmdbRes) {
		var body = [];
		tmdbRes.on('data',function(chunk) {
			body.push(chunk);
		});

		tmdbRes.on('end', function() {
			var bodyString = body.join('');
			var rsp = JSON.parse(bodyString);
			
			//if there were any matches
			if (rsp.results.length > 0){
				title = "Similar titles to: " + appReq.query['t'];
				createPage(title,rsp, function(str){
					//write string and end
					appRes.writeHead(200,{'content-type': 'text/html'});
					appRes.write(str);
					appRes.end();
				});
			}
		});
	});

	tmdbReq.on('error', (e) => {
		console.error(e);
	});

	tmdbReq.end();
});


app.get('/', function(appReq, appRes) {

	function createTMDBOptions(tmdbCredentials) {

		var options = {
			hostname: 'api.themoviedb.org',
			port: 443,
			path: '/3/genre/movie/list?',
			method: 'GET'
		}

		//get genre list
		var s = 'api_key=' + tmdbCredentials.api_key;
			options.path += s;
		return options;
	}

	var tmdbOptions = createTMDBOptions(tmdbCredentials);

	var tmdbReq = https.request(tmdbOptions, function(tmdbRes) {
		var body = [];
		tmdbRes.on('data',function(chunk) {
			body.push(chunk);
		});

		tmdbRes.on('end', function() {
			var bodyString = body.join('');
			var rsp = JSON.parse(bodyString);
			
			var	 str = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN""http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">' +
			 '<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en"lang="en"><head><title>Movie Galaxy</title>'
			 + '<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css">'
			 + '<link href="/style.css" rel="stylesheet" type="text/css"/>'
			 + '<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.3/jquery.min.js"></script>' 
			 + '<script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js"></script>' + '</head>' +
			 '<body>';

			str += '<div class="banner">';
				str += '<img class="logo" src="/img/logo.png">';
			str += '</div>';
				
			str += '<div class="container">';

				//if redirected by invalid user input
				if (appReq.query['invalid'] == 1){
					str += '<div class="alert alert-danger alert-dismissible" data-dismiss="alert" role="alert"><button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>Sorry we could not find any movies matching that title.</div>';
				}

				//if redirected by null user input
				if (appReq.query['empty'] == 1){
					str += '<div class="alert alert-danger alert-dismissible" data-dismiss="alert" role="alert"><button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>Please enter a movie title.</div>';
				}

				str += '<div class="col-md-6">';
					str += '<h3>Search by Genre</h3>';
					str += '<form action="/search" method="GET">';
						str += '<div class="form-group">';
							str += '<select type="select" name="genre" tabindex="5" class="form-control">';
								for(i = 0; i < rsp.genres.length; i++){
									str += '<option value="'+ rsp.genres[i]['id'] +'">' + rsp.genres[i]['name'] + '</option>';
								}
							str += '</select>';
						str += '</div>';
						str += '<div class="form-group">';
							str +='<div class="col-sm-6 col-sm-offset-3">'
								str += '<input type="submit" tabindex="8" class="form-control btn btn-primary" value="Search">';
							str += '</div>';
						str += '</div>';
					str += '</form>'; //end form
				str += '</div>'; //end column
				str += '<div class="col-md-6">';
					str += '<h3>Search by Title</h3>';
					str += '<form method="GET">';
						str += '<div class="form-group">';
							str +='<input  type="text" name="query" class="form-control" placeholder="Movie name" value="">';
						str += '</div>';
						str += '<div class="form-group">';
							str +='<div class="col-sm-6 col-sm-offset-3">'
								str += '<input type="submit" tabindex="8" class="form-control btn btn-primary" value="Search Movie" formaction="/exact">';
							str += '</div>';
						str += '</div>';
					str += '</form>'; //end form
				str += '</div>'; //end column
			str += '</div>'; //end container

			str += '<br>';

			str += "<div class='footer'>";
		 		str += "<hr>";
 		 		str += "API Mashup by Andrew Hill <br> CAB432 [Cloud Computing] QUT 2016 Semester 2";
 		 		str += "<br> APIs used: <a href='https://www.themoviedb.org/documentation/api'>themoviedb.org</a> | <a href='http://www.omdbapi.com/'>omdbapi.com</a> | <a href='https://api.guidebox.com/'>guidebox.com</a>";
 		 	str += "</div>";

			str + '</body></html>';

			appRes.writeHead(200,{'content-type': 'text/html'});
			appRes.write(str);
			appRes.end();
		});
	});

	tmdbReq.on('error', (e) => {
		console.error(e);
	});

	tmdbReq.end();

});

app.listen(port, function () {
	console.log(`Express app listening on port: ${port}`);
});