const enigma = require('enigma.js');
const WebSocket = require('ws');
const fs = require('fs');
const util = require('util')
var winston = require('winston');
var config = require('config');
var yaml = require('js-yaml');
var http = require('http');
var url = require("url");



//Function
var eventify = function(arr, callback) {
    arr.push = function(e) {
        Array.prototype.push.call(arr, e);
        callback(arr);
    };
	arr.shift = function(e) {
        callback(arr);
        return Array.prototype.shift.call(arr, e);
    };
};

const { combine, timestamp, label, printf } = winston.format;
const consoleFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

// Set up Winston logger, logging both to console and different disk files
//var logger = new (winston.Logger)({
var logger = winston.createLogger({
    transports: [
        new winston.transports.Console({
            name: 'console_log',
            timestamp: true,
            //colorize: true,
			level: config.get('defaultLogLevel'),
			format: winston.format.combine(
				winston.format.colorize({message: true}),
				winston.format.timestamp(),
				consoleFormat
			  )
        }),
        new (winston.transports.File)({
            name: 'file_info',
            filename: config.get('logDirectory') + '/info.log',
            level: 'info',
			format: winston.format.combine(
				winston.format.timestamp(),
				winston.format.json()
			)
        }),
        new (winston.transports.File)({
            name: 'file_verbose',
            filename: config.get('logDirectory') + '/verbose.log',
            level: 'verbose',
			format: winston.format.combine(
				winston.format.timestamp(),
				winston.format.json()
			)
        }),
        new (winston.transports.File)({
            name: 'file_error',
            filename: config.get('logDirectory') + '/error.log',
            level: 'error',
			format: winston.format.combine(
				winston.format.timestamp(),
				winston.format.json()
			)
        }),
        new (winston.transports.File)({
            name: 'file_debug',
            filename: config.get('logDirectory') + '/debug.log',
            level: 'debug',
			format: winston.format.combine(
				winston.format.timestamp(),
				winston.format.json()
			)
        })
    ]
});

// Set default log level
//logger.transports.console_log.level = config.get('defaultLogLevel');
logger.log('info', 'Starting Qlik Sense cache warmer.', {label:'All Servers'});

//read QIX schema
const qixSchema = require('enigma.js/schemas/' + config.get('qixVersion') + '.json');
// Read certificates
const client = config.has('clientCertPath') ? fs.readFileSync(config.get('clientCertPath')): null;
const client_key = config.has('clientCertPath') ? fs.readFileSync(config.get('clientCertKeyPath')): null;

var appConfigYaml = '';

var server = http.createServer(function(req, res) {
	var page = url.parse(req.url).pathname;
	var args = page.split('/');
	try {
		appConfigYaml = fs.readFileSync('./config/apps.yaml', 'utf8');
	} catch(e) {
		logger.log('error', 'Error while reading app config data: ' + e, {label:'...'})
	}
	if(args[2]=='table' && args[3]===undefined){
		var appId=args[1];
		res.writeHead(200);
		request('listtables',appConfigYaml,appId,res);

	}else if(args[2]=='table' && args[3].length>0){
		var appId=args[1];
		res.writeHead(200);
		request('gettable',appConfigYaml,appId,res,args[3]);

	}else{
		res.writeHead(404);
		res.end('Nothing here!');
	}
});
server.listen(8080);










//
var appRunning=0;
var appServeur=[];
var lastTime=[];
var dateStart=new Date().toISOString();


function request(action,appConfigYaml,appId,res,param1='') {
    // Load app config doc, or throw exception on error
    try {

        var appConfigDoc = yaml.safeLoad(appConfigYaml);
        console.log(appConfigDoc);
        console.log('');

		var config='';
        // Loop over all apps in app config file
        appConfigDoc.apps.forEach(function(appConfig) {
			if(appConfig.appId==appId){
				config=appConfig;
			}
        }, this);
		//Launch the requests
		if(config!=''){
			launch(action,config,res,param1);
		}else{
			res.end('Unknown appId');
		}
		

		

    } catch (e) {
        logger.log('error', 'Error while reading app config data: ' + e, {label:'...'})
    }

}

//function loadAppIntoCache(appConfig,serveur,index,res) {
function launch(action,appConfig,res,param1) {
    logger.log('verbose', 'Starting loading of appid ' + appConfig.appId, {label:appConfig.server});
	const SenseUtilities = require('enigma.js/sense-utilities');
    // Load the app specified by appId
    const configEnigma = {
        schema: qixSchema,
		url: SenseUtilities.buildUrl({
            host: appConfig.server,
            port: config.has('clientCertPath') ? 4747 : 4848,  // Engine /Desktop port
            secure: config.get('isSecure'),
            disableCache: true
        }),
        createSocket: (url, sessionConfig) => {
            return new WebSocket(url, config.has('clientCertPath') ? {
                // ca: rootCert,
                key: client_key,
                cert: client,
                headers: {
                    'X-Qlik-User': 'UserDirectory=Internal;UserId=sa_repository'
                },
                rejectUnauthorized: false
            } : {});
        }
    };
	
	// Load the app specified by appId
	var session=enigma.create(configEnigma);
	
	
	session.open().then((qix) => {
		const g = qix;

        // Connect to engine
        logger.log('debug', 'Connecting to QIX engine on ' + appConfig.server, {label:appConfig.server});
		lastTime[appConfig.server+':'+appConfig.appId]=Date.now();


		g.openDoc(appConfig.appId).then((app) => {
            logger.log('info', 'App loaded: ' + appConfig.appId, {label:appConfig.server});
			
			var now=Date.now();
			var duration=now-lastTime[appConfig.server+':'+appConfig.appId];

            // Clear all selections
            logger.log('debug', appConfig.appId + ': Clear selections', {label:appConfig.server});
            app.clearAll(true);
			
			
			if(action=='listtables'){
			///////////////////listtables/////////////////
				var param={
					"qWindowSize": {
						"qcx": 0,
						"qcy": 0
					},
					"qNullSize": {
						"qcx": 0,
						"qcy": 0
					},
					"qCellHeight": 0,
					"qSyntheticMode": false,
					"qIncludeSysVars": false
				};
				var returnTable=[];
				app.getTablesAndKeys(param).then((layout) => {
					layout.qtr.forEach(function(table) {
						returnTable.push(table.qName);
					})
					res.end(JSON.stringify(returnTable));
				})
			///////////////////listtables/////////////////
			}else if (action=='gettable'){
			///////////////////gettable/////////////////
				var param={
					"qWindowSize": {
						"qcx": 0,
						"qcy": 0
					},
					"qNullSize": {
						"qcx": 0,
						"qcy": 0
					},
					"qCellHeight": 0,
					"qSyntheticMode": false,
					"qIncludeSysVars": false
				};
				app.getTablesAndKeys(param).then((layout) => {
					layout.qtr.forEach(function(table) {
						if(table.qName ==param1){
							var returnTable=[];
							var returnLine=[];
							var model=[];
							table.qFields.forEach(function(field,id) {
								returnLine.push(field.qName);
								model.push(field.qName);
							})
							
							
							
							/////////
							var param={
								"qOffset": 0,
								"qRows": table.qNoOfRows,
								"qSyntheticMode": false,
								"qTableName": table.qName
							};
							app.getTableData(param).then((tableData) => {
								tableData.forEach(function(line) {
									var returnLine=[];
									var returnObject={};
									line.qValue.forEach(function(value,id) {
										returnLine.push(value.qText);
										returnObject[model[id]]=value.qText;
									})
									returnTable.push(returnObject);
								})
								app.session.close();
								res.end(JSON.stringify(returnTable));
								logger.log('debug', appConfig.appId+':'+table.qName + ': Table Fetched', {label:appConfig.server});
							})
							;
							
							
							
							/////////
						}
					})
				})
				;
				///////////////////gettable/////////////////
			}

        })
        .catch(err => {
            // Return error msg
            logger.log('error', 'openApp error: ' + JSON.stringify(err), {label:appConfig.server});
            return;
        })
    })
    .catch(err => {
        // Return error msg
        logger.log('error', 'enigma error: ' + JSON.stringify(err), {label:appConfig.server});
        return;
    });

}
