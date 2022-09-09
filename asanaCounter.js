const fs = require("fs");
var http = require("https");
const WO_PROJ_ID = "1201404570859641"
const AMBI_TOKEN = '1/1201767614608131:ed08e5bd83382f3cccc9b3e40919334b';

async function makeGetRequest(path) {

    var options = {
        "method": "GET",
        "hostname": "app.asana.com",
        "port": null,
        "path": path,
        "headers": {
        "accept": "application/json",
        "content-type": "application/json",
        "Authorization": `Bearer ${AMBI_TOKEN}`
        }
    };

    return new Promise((resolve, reject) => {

        var req = http.request(options, function (res) {
          var chunks = [];

          res.on("data", function (chunk) {
            chunks.push(chunk);
          });

          res.on("end", function () {

            var body = Buffer.concat(chunks);

            resolve(JSON.parse(body));

          });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.end();

    });

}
async function makePutRequest(path, body) {

    var options = {
        "method": "PUT",
        "hostname": "app.asana.com",
        "port": null,
        "path": path,
        "headers": {
        "accept": "application/json",
        "content-type": "application/json",
        "Authorization": `Bearer ${AMBI_TOKEN}`
        }
    };

    return new Promise((resolve, reject) => {

        var req = http.request(options, function (res) {
          var chunks = [];

          res.on("data", function (chunk) {
            chunks.push(chunk);
          });

          res.on("end", function () {

            var body = Buffer.concat(chunks);

            resolve(JSON.parse(body));

          });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.write(JSON.stringify(body));

        req.end();

    });

}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function getAllEvents(resourceID, syncToken) {

    let events = [];
    let response;

    do {

        response = await makeGetRequest(`/api/1.0/events?resource=${resourceID}&sync=${syncToken}`);

        if(response.errors) {

            return null;
        }

        syncToken = response.sync;

        for(let event of response.data) {

            events.push(event);
        }

    } while(response.has_more)

    return {events:events, syncToken:syncToken};

}

async function getCustomFieldFromProject(projectID, customFieldString) {

    let response = await makeGetRequest(`/api/1.0/tasks?project=${projectID}`);

    if(response.data) {

        let taskInfo = await makeGetRequest(`/api/1.0/tasks/${response.data[0].gid}`);

        for(let customField of taskInfo.data.custom_fields) {

            if(customField.name == customFieldString) {
                return customField.gid;
            }
        }
        return null;

    }
    else {

        return null;
    }
}

async function main() {

    let response, syncToken, eventData;
    let lastWO = JSON.parse(fs.readFileSync('Last-WO.json'));
    let WOFieldID = await getCustomFieldFromProject(WO_PROJ_ID, "WO Number");

    if(!WOFieldID) {
        console.log("WO Field not found in project!")
        return;
    }

    console.log(WOFieldID);

    while(true) {

        // Get a new sync token
        response = await makeGetRequest(`/api/1.0/events?resource=${WO_PROJ_ID}`);
        syncToken = response.sync;
        console.log(`Got a new sync token: ${syncToken}`)

        do {

            // sleep 5 secs
            console.log(`sleeping 15 secs...`)
            await sleep(1000*15);

            // get all events in the past 15 secs, will return null if sync token is expired
            console.log("Checking for new events...")
            eventData = await getAllEvents(WO_PROJ_ID, syncToken);

            try {
                for(let event of eventData.events) {

                    console.log(`got new event, checking...`)

                    // if event is task added
                    if (event.action == 'added' &&
                        event.type == 'task' &&
                        event.parent.name == `WO's`) {

                        console.log("new event is task added")

                        let response = await makePutRequest(`/api/1.0/tasks/${event.resource.gid}`,
                                                          {"data": {"custom_fields":{[WOFieldID]:lastWO.index+1}}});

                        if(response.data) {

                            lastWO.index += 1;
                            await fs.writeFileSync('Last-WO.json', JSON.stringify(lastWO));
                            await sleep(1000*2)
                        }

                        console.log(response)
                    }
                    else {
                        console.log("new event is not task added")
                    }
                }
            }
            catch (error) {

                console.log(error);
            }

            syncToken = eventData.syncToken;

        } while(eventData);
    }
}

main();
