// for developer search api
var express = require('express');
var elasticsearch = require('elasticsearch');

var program = require('commander');

program
    .option('-p, --port <port>', 'Port on which to listen to (defaults to 3000)', parseInt)
    .option('-e, --eshost <host>', 'Port on which to listen to (defaults to localhost:9200)')
    .parse(process.argv);

var port = program.port || 3000;
var endPoint = program.eshost || 'localhost:9200';

var esClient = new elasticsearch.Client({
    host: endPoint.split(',')
});

var index = 'developer';
var type = 'docs';


var app = express();
app.get('/', function(req, res) {
    var q = req.query.query;
    if (!q) {
        res.status(400);
        return res.end();
    }

    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log(new Date().getTime(), ip, q, req.get('Referer'), req.get('User-Agent'));
    esClient.search({
        index: index,
        type: type,
        body: {
            "query": {
                "query_string": {
                    "query": q
                }
            },
            "highlight": {
                "fields": {
                    "title": {},
                    "content": {}
                }
            }
        }
    }).then(function(resp) {
        var items = [];
        var hits = resp.hits.hits;
        for (var i = 0; i < hits.length; i++) {
            if (hits[i].highlight) {
                if (hits[i].highlight.content) {
                    hits[i]._source.doc.description = hits[i].highlight.content[0];
                }
                if (hits[i].highlight.title) {
                    hits[i]._source.doc.title = hits[i].highlight.title[0];
                }
            }
            hits[i]._source.doc.description = hits[i]._source.doc.description || hits[i]._source.doc.content;
            if (hits[i]._source.doc.description.length > 200) {
                hits[i]._source.doc.description = hits[i]._source.doc.description.substring(0, 200) + '...';
            }
            items.push(hits[i]._source.doc);
        }
        if (req.query.callback) {
            res.jsonp({
                'items': items
            });
        } else {
            res.send({
                'items': items
            });
        }
    });
});
app.listen(port);
