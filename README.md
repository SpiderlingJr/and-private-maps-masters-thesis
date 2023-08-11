This repository features the prototype of AND Private Maps developed in the Masters Thesis.

Running it requires a NodeJS environment, using yarn or npm as package manager, as well as Docker to be installed.

The results provided in the thesis are in TestResults.xlsx. This table also features a discription on used hardware.

# Setting up

Initializing / Starting up the database 

```
$ docker compose up
```

Accessing the database can be done using pgAdmin on the port the port it was intialized on, configured in docker-compose.yml.

The setup script is provided in demoDbScript.pgsql.

Initializing environment

```
yarn install
```

Running the service
```
yarn run dev
```
See package.json for startup variants.

To choose an invalidation strategy, prior to startup, set the EVICTION_STRATEGY variable in the .stratEnv-File to one of **BOXCUT_ITER** (Naive Boxcut Strategy), **EXACT** (Exact Strategy), **CLUSTER_BOXCUT** (Cluster Boxcut Strategy) or **CLUSTER_EXACT** (Cluster Exact Strategy)

To configure the maximum zoom level operated on, change the **MAX_ZOOM** variable in .env to the desired level. Note that this requires the database to have the mvt<MAX_ZOOM> table initialized. This is done prior to starting the web service. 

Posting and Updating data
---

Posting data can be done by sending a HTTP POST request to the /data endpoint, with a multipart body consisting of one NDJSON file. Examples are found in the test/data/static and test/data/dynamic directories. This post request can be sent by a software like [PostMan](https://www.postman.com/). On successful post, the service responds with a Collection ID as well as a Job ID.

Patching data can be done by sending a HTTP PATCH request to the /collections/:collectionId. Replace :collectionId with the respective collection id. Use the patch examples for the previously mentioned directories as example on how to include the feature ids of patched features.

Running the frontend
---

The frontend can be run using
```
cd frontend; yarn run dev
```

Per default, it runs on port 5173. So it's accessible from localhost:5173 in a browser.

The frontend features an OpenStreetMap base map with a vector tile overlay. You can visualize prefabricated datasets using the drop-down menu or visualise own collections.

Structure
---

- The implementation of our strategies is found in src/plugins/dbPlugin.ts
- The measurement logic is in src/plugins/performanceMeterPlugin.ts
- Our API is defined in the files from src/routes
- The entry point of the service is app.ts
- The Table definition our system uses to create the database is in src/entities. This means, upon service startup, the service will create the database tables if not already existing. However, it will not fill the mvt tables. This is done using the fill_mvts_function provided in the demo setup query.