import * as functions from 'firebase-functions';
const fetch = require("node-fetch");
const crypto = require('crypto')

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

export const webHookListener = functions.https.onRequest(async (request, response) => {
    const data = JSON.stringify(request.body);
    const fsSignatureHeader = request.header("FullStory-Signature");

    try{
        if(!checkHmac(fsSignatureHeader, data)) {
            response.sendStatus(401); 
            return;
        }
        await sendToSegment(request);
    }catch(error){
        console.error(error);
        response.sendStatus(500);
    }

    response.sendStatus(200);
});


const sendToSegment = async (content:functions.https.Request)=>{
    const eventName:string = content?.body?.eventName || "";
    const userId:string = content?.body?.data?.author || "";
    const properties:string = content?.body?.data || "";
    
    const body = {
        event: eventName,
        properties: properties,
        userId: userId
    }
    try{
        const response = await fetch("https://api.segment.io/v1/track", {
            method: 'POST',
            body: JSON.stringify(body),
            //set your encoded segment write key
            headers: {'Content-Type': 'application/json', 'Authorization': 'Basic ' + functions.config().segment.key} }); 
        return response;
    }catch(error){
        console.error(error);
    }
}

const checkHmac = (signature:string|undefined, data:string) =>{
    if(!signature) return false;
    const orgId = signature.match(/o:(.+),t:/);
    const timestamp = signature.match(/t:(.+),v:/);
    const v = signature.match(/,v:(.+)/);
    if(orgId && timestamp && v){
        const hmac = calculateHMAC(data,orgId[1],timestamp[1]);
        if(hmac !== v[1]) return false;
    }
    return true;
}

const calculateHMAC = (data:string,orgId:string,timestamp:string)=>{
    //TODO: veryfy time stamp

    //your shared secret from FS
    const key = functions.config().fullstory.key;
    const payload:string = data + ':' + orgId + ':' + timestamp;
    const hmac = crypto.createHmac('sha256', key)
    .update(payload)
    .digest('base64')

    return hmac;
}