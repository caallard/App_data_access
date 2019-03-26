# App_data_access
Access to data in a Qlik Sense app

## Installation and setup

1. Make sure you have a recent version of [Node.js](https://nodejs.org) installed. Node 10.15.0 was used during development of the app data access.
2. [Clone the GitHub repository](https://github.com/caallard/App_data_access.git) to local disk, or download and extract the [ZIP:ed repo](https://github.com/caallard/App_data_access/archive/master.zip) from GitHub.
3. From within the directory where you placed the App_data_access files, run 

    `npm i` 
    
4. Once the various dependencies have downloaded, copy the ./config/rename-default.json file to ./config/default.json
5. Edit default.json as needed, using paths etc for your local system
6. Copy the ./config/rename-apps.yaml file to ./config/apps.yaml
7. Edit ./apps.yaml, specifying wich Sense apps can be accessed by the App_data_access. 


## Usage
Start the service by running "node index.js".

1. You can access to the list of tables of the app  http://[servername]:8080/[appId]/table . The data returned is an Json array of tables names.
2. You can access to the data of a table  http://[servername]:8080/[appId]/table/[TableName] . The data returned is an Json array of objects.

## Links & references
Inspiration to this project came from [butler CW] (https://github.com/ptarmiganlabs/butler-cw) build by Ptarmigan Labs.
