var fs = require('fs')
, Spotify = require('spotify-web')
, lame = require('lame')
, Speaker = require('Speaker')
, Table = require('cli-table')
, _ = require('underscore')
, _s = require('underscore.string')
, moment = require('moment')
, colors = require('colors')
, request = require('request');

_.mixin(_s.exports());

var config = fs.readFileSync(__dirname+'/config.json', 'UTF8');
config = JSON.parse(config);

if(!config.username || !config.password) {
    console.log('Please set your username and password in the config.json file to use this application' .red);
    process.exit(0);
}

var readline = require('readline'),
    rl = readline.createInterface(process.stdin, process.stdout)
    , sigcount = 0;

var spotify = null;
console.log("Test connection to Spotify\n" .green)
Spotify.login(config.username, config.password, function (err, spot) {
    spotify = spot;

    spotify.on('close', function(){
        console.log("Spotify connection closed" .red);
    })

    console.log("Successfully established connection to account "+config.username+"\n");
    rl.setPrompt('DIM Spot(y) > ');
    rl.prompt();
})

function spotifyConnect(callback) {
    console.log('\n');
    console.log('Establishing connection to spotify .. ' .cyan);
    Spotify.login(config.username, config.password, function (err, spot) {
        console.log('Connection established..' .green);
        callback(null, spot);
    })
}

var getTrack = function(trackId) {
    spotifyConnect(function(err, spotify){
        spotify.get(trackId, function (err, track) {
            if (err) throw err;

            var duration = moment.duration(track.duration).minutes()+':'+moment.duration(track.duration).seconds();

            console.log("\n");
            console.log('SAVING: %s - %s |  Duration: %s ' .cyan, track.artist[0].name, track.name, duration);

            var writeStream = fs.createWriteStream('./stored/'+track.artist[0].name+'_'+track.name+'.mp3');
            track.play()
                .pipe(writeStream)

            writeStream.on('close', function(){
                console.log("Track saved.." .green)
                console.log("\n");
                spotify.disconnect();
                return rl.prompt();
            })
        });
    })
}

var playTrack = function(trackId) {
    spotifyConnect(function(err, spotify){
        spotify.get(trackId, function (err, track) {
            if (err) throw err;

            var duration = moment.duration(track.duration).minutes()+':'+moment.duration(track.duration).seconds();

            console.log("\n");
            console.log('Playing: %s - %s |  Duration: %s ' .cyan, track.artist[0].name, track.name, duration);

            track.play()
                .pipe(new lame.Decoder())
                .pipe(new Speaker())
                .on('finish', function () {
                    spotify.disconnect();
                });
        });
    })
}


// TODO: Album and Author downloads
rl.on('line', function(line){
    if(!line) return rl.prompt();

    var cmds = _.words(line)

    switch(cmds[0]) {
        case "track":
            getTrack(cmds[1]);
        break;
        case "play":
            playTrack(cmds[1]);
        break;
        case "find":
            var test = _.rest(cmds).join('+');
            var table = new Table({
                head: ['Index', 'Artist', 'Track', 'Spotify-ID'],
                colWidth: [12, 30, 30, 30]
            });
            var results = [];
            request('http://ws.spotify.com/search/1/track.json?q='+test, function(errors,response,body){
                if(response.body) {
                    var obj = JSON.parse(response.body);
                    results = obj.tracks;
                    var i = 0;
                    var done = _.map(results, function(result){
                        i++;
                        table.push([i, _.first(result.artists) ? _.first(result.artists).name : 'Unknown', result.name ? result.name : 'Unknown', result.href]);
                        return result;
                    })
                    if(done) {

                        if(results.length === 0) {
                            console.log('No results found' .red);
                            console.log('\n');
                            return rl.prompt();
                        }

                        console.log(table.toString());
                        console.log('\n');

                        rl.question('Enter the s+index to save, p+index to play to download or e[xit] to abort > ', function(answer){
                            if(answer.match('^e')) {
                                return rl.prompt();
                            } else if(answer.match('^s') || answer.match('^p')) {
                                var subCmd = _.chop(answer, 1);
                                var index = parseInt(subCmd[1])-1;
                                var track = results[index];
                                if(subCmd[0] == 'p') {
                                    playTrack(track.href);
                                } else {
                                    getTrack(track.href);
                                }
                            } else {
                                console.log('Unknow command asuming exit .. ');
                                return rl.prompt();
                            }
                        })
                    }
                }
            })
        break;
        default:
            console.log("Unknown Command\n" .red);
            return rl.prompt();
    }
}).on('SIGINT', function() {
  sigcount++;
  if(sigcount >= 2){
        console.log("Shutting down process ... " .cyan);
        console.log("So long and thanks for the fish :) " .green.bold);
          process.exit(0);
  } else {
          console.log("\nPlease press CTRL+D again to exit" .magenta)
  }
}).on("SIGCONT", function(){
    rl.prompt();
})

