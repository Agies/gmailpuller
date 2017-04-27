var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var gmail = google.gmail('v1');
var googleAuth = require('google-auth-library');

const scopes = ['https://www.googleapis.com/auth/gmail.readonly'];
const tokenDir = (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) + '/.credentials/';
const tokenPath = tokenDir + 'gmail.json';

fs.readFile('client_secret.json', (err, content) => {
    if (err) {
        console.log('Error loading client secret: ' + err);
        return;
    }
    authorize(JSON.parse(content), list);
});

function authorize(credentials, callback) {
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    fs.readFile(tokenPath, (err, token) => {
        if (err) {
            getNewToken(oauth2Client, callback);
        } else {
            oauth2Client.credentials = JSON.parse(token);
            callback(oauth2Client);
        }
    });
}

function getNewToken(oauth2Client, callback) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Enter the code from that page here: ', code => {
        rl.close();
        oauth2Client.getToken(code, (err, token) => {
            if (err) {
                console.log('Error while trying to retrieve access token', err);
                return;
            }
            oauth2Client.credentials = token;
            storeToken(token);
            callback(oauth2Client);
        });
    });
}

function storeToken(token) {
    try {
        fs.mkdirSync(tokenDir);
    } catch (err) {
        if (err.code != 'EEXIST') {
            throw err;
        }
    }
    fs.writeFileSync(tokenPath, JSON.stringify(token));
    console.log('Token stored to ' + tokenPath);
}

function list(auth) {
    gmail.users.messages.list({
        auth: auth,
        userId: 'me',
        format: 'full',
        q: '"the code is"'
    }, (err, response) => {
        if (err) {
            console.log('The API returned an error: ' + err);
            return;
        }
        var items = response.messages;
        if (!items || items.length == 0) {
            console.log('No messages found.');
        } else {
            items.forEach(i => detail(auth, i));
        }
    });
}

function detail(auth, mes) {
    gmail.users.messages.get({
        auth: auth,
        userId: 'me',
        id: mes.id
    }, (err, message) => {
        var data = message.payload.parts[0].body.data;
        if (data) {
            console.log('- %s', Buffer.from(data, 'base64'));
        }
    });
}