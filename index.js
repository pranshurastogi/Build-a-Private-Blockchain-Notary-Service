// Requiring the necessary libraries and modules
const express = require('express');
const bodyParser = require('body-parser');
const bitcoin = require('bitcoinjs-lib');
const bitcoinMessage = require('bitcoinjs-message');
const Blockchain = require('./Blockchain');
const Block = require('./Block');
const BlockDB = require('./BlockDB');
const {
  blockSchema,
  validateSignature,
  requestValidationSchema,
  signatureValidationSchema,
  validateRequest,
  starRegistrationSchema,
  asciiToHexa,
  hexaToAscii,
} = require('./SchemaDefs');

const PORT = 8000;

// This is a global cache that will store validation requests for a certain time period
let requestCache = {};

// Global "signature" variable to hold the manually generated signature string
let signature = "";

// Initialising the blockchain with genesis block on server startup
let blockDb = new BlockDB('./start-notary-db');
let blockChain = new Blockchain(blockDb);

// Creating an Express App and registering middlewares
const app = express();

// for parsing application/json/x-www-form-urlencoded
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/* ===== Route Handlers Below ==============================*/
// GET /block/{block_height} to get a star at a specified block height
app.get('/block/:height', async (req, res) => {
    const height = parseInt(req.params.height);

    // Get the block from LevelDB
    let block = await blockChain.getBlock(height);

    // If LevelDB returns a block, send that block as a JSON response to client
    try {
      if (block) {
          //console.log(block);
          //console.log(JSON.stringify(block));
          let jsonBlock = JSON.parse(JSON.stringify(block));
          if (jsonBlock.body.star) {
              jsonBlock.body.star["storyDecoded"] = hexaToAscii(jsonBlock.body.star.story);
          }
          return res.set("Content-Type", "application/json")
                    .send(jsonBlock);
      }
    }
    catch(e) {
      console.log("Exception:  ", e.stack);
    }

    // If LevelDB doesnt return a block, then send an error object
    let reason = "";
    if (height) {
        reason = `Bad Request. Block with height ${height} does not exist`;
    } else {
        reason = `Bad Request. Invalid value/type for block height`;
    }

    let response = {
        status_code: 400,
        status: "Failed retrieving Resource",
        reason: reason,
    };
    return res.status(response.status_code)
              .set("Content-Type", "application/json")
              .send(response);

});

// GET /block/stars/walletaddress to get a star at a specified block height
app.get('/stars/address::addr', async (req, res) => {
    let address = req.params.addr.toString();
    //console.log("Address is:  ", address);

    let response = {
        status_code: null,
        status: null,
        reason: null,
    };

    // Get all stars against a certain wallet address
    let stars = await blockChain.getAllStarsOfWallet(address);

    // Checking if the DB query was successfull or not
    if (!stars) {

        let reason = `Could not retrieve stars for wallet: ${address}`;
        response.status_code = 500;
        response.status = "Internal Server Error.";
        response.reason = reason;

        return res.status(response.status_code)
                  .set("Content-Type", "application/json")
                  .send(response);
    }

    // Check if the returned stars array has length. If zero, then no stars for that address
    if (stars.length === 0) {

        let reason = `Bad Request. No stars for wallet: ${address}`;
        response.status_code = 400;
        response.status = "Star Info Retrieval Failed.";
        response.reason = reason;

        return res.status(response.status_code)
                  .set("Content-Type", "application/json")
                  .send(response);
    }

    // If there are stars for the wallet address return them with decoded story
    let starsWithDecodedStory = [];
    for (let starObject of stars) {
        starObject.body.star["storyDecoded"] = hexaToAscii(starObject.body.star.story);
        starsWithDecodedStory.push(starObject);
    }

    return res.status(200)
              .set("Content-Type", "application/json")
              .send(starsWithDecodedStory);

});

// GET /block/stars/starHash to get a star at a specified block hash
app.get('/stars/hash::blockHash', async (req, res) => {
    const blockHash = req.params.blockHash.toString();

    let response = {
        status_code: null,
        status: null,
        reason: null,
    };

    // Get star against blockHash
    let star = await blockChain.getStarAgainstHash(blockHash);

    // Checking if the DB query was successfull or not
    if (!star) {

        let reason = `Could not retrieve star for blockHash: ${blockHash}`;
        response.status_code = 500;
        response.status = "Internal Server Error.";
        response.reason = reason;

        return res.status(response.status_code)
                  .set("Content-Type", "application/json")
                  .send(response);
    }

    // Check if the returned star array has length. If zero, then no stars for that address
    if (star.length === 0) {

        let reason = `Bad Request. No star for blockHash: ${blockHash}`;
        response.status_code = 400;
        response.status = "Star Info Retrieval Failed.";
        response.reason = reason;

        return res.status(response.status_code)
                  .set("Content-Type", "application/json")
                  .send(response);
    }

    // If there is a star for the blockHash return it with decoded story
    let starWithDecodedStory = [];
    for (let starObject of star) {
        starObject.body.star["storyDecoded"] = hexaToAscii(starObject.body.star.story);
        starWithDecodedStory.push(starObject);
    }

    return res.status(200)
              .set("Content-Type", "application/json")
              .send(starWithDecodedStory[0]);

});

// POST /block to add new stars blocks to the chain
app.post('/block', async (req, res) => {

    // Validate the request body to check if it conforms to schema
    const result = validateRequest(req.body, starRegistrationSchema);

    let response = {
        status_code: null,
        status: null,
        reason: null,
    };

    console.log("result.error:    ",result.error)
    // If request doesnt conform to schema, then send error as response
    if (result.error) {
        let reason = `Bad Request. ${result.error.details[0].message}`;
        response.status_code = 400;
        response.status = "Input Validation Failed";
        response.reason = reason;

        return res.status(response.status_code)
                  .send(response);
    }

    // If story is more than 250 words, return error
    if (req.body.star.story.split(" ").length > 250) {
        let reason = `Star story has to be 250 or less words`;
        response.status_code = 400;
        response.status = "Input Validation Failed";
        response.reason = reason;
        return res.status(response.status_code)
                  .send(response);
    }

    // Request body is in correct conformation with schema.
    // 1. Check if star registration request has been made within the validation window
    let address = req.body.address;
    let requestObject = requestCache[address];

    if (!requestObject) {
        response.status_code = 400;
        response.status = "Star Registration Failed";
        response.reason = "Validation request was not made within validation window or the given" +
            " wallet address never made a prior request validation request";
        return res.status(response.status_code)
                  .send(response);
    }

    //verify the message using bitcoin functions and the provided signature and cached message
    // "message": "address:requestTimeStamp:starRegistry"
    if (validateSignature(requestObject.message, address, signature) !== true) {
        response.status_code = 400;
        response.status = "Signature Validation Failed.";
        response.reason = "The provided credentials failed to sign the message, hence STAR block " +
                "registration cannot be processed!";
        return res.status(response.status_code)
                  .send(response);
    }

    // 2. If request was made within validation window
    // Go on with star registration
    // First Hex code the Ascii story attribute in the star object of the request body
    let hexStory = asciiToHexa(req.body.star.story);
    req.body.star.story = hexStory;

    // Then go onto adding a new block to the blockchain with the star information
    let newBlock = await blockChain.addBlock(new Block(req.body));

    // If block addition fails due to some server / DB error, send error back
    if (newBlock) {
        delete requestCache[address]; // delete the address from the cache to remove the user
        return res.status(200)
                  .set("Content-Type", "application/json")
                  .send(newBlock);
    } else {

        response.status_code = 500;
        response.status = 'Internal server error';
        response.reason = 'Could not add block to Blockchain.';
        return res.status(response.status_code)
                  .set("Content-Type", "application/json")
                  .send(response);
    }

});

// POST /requestValidation
app.post('/requestValidation', async (req, res) => {
    // Validate the request body to check if it conforms to schema
    const result = validateRequest(req.body, requestValidationSchema);

    // If request doesnt conform to schema, then send error as response
    if (result.error) {
        let reason = `Bad Request. ${result.error.details[0].message}`;
        let response = {
            status_code: 400,
            status: "Input Validation Failed.",
            reason: reason,
        };
        return res.status(response.status_code)
                  .send(response);
    }

    // Request body is in correct conformation with schema
    // Check if user is resubmitting request or not. If yes, reduce his validation window
    let address = req.body.address;
    let requestObject = requestCache[address];

    if (requestObject) {
        let time = new Date().getTime().toString().slice(0, -3);
        let timeElapsed = time - requestObject.requestTimeStamp;
        let newValidationWindow = 300 - timeElapsed;
        requestObject.validationWindow = newValidationWindow;
        requestCache[address] = requestObject;

        return res.status(200)
                  .set("Content-Type", "application/json")
                  .send(requestCache[address]);

    }

    // If user has never previously made a request, send response with full 5 min window
    let time = new Date().getTime().toString().slice(0, -3);
    let userResponse = {
        address: req.body.address,
        requestTimeStamp: time,
        message: `${req.body.address}:${time}:starRegistry`,
        validationWindow: 300
    };

    // save the request in the cache for the setTimeout delay period
    requestCache[userResponse.address] = userResponse;
    setTimeout(() => {
        delete requestCache[userResponse.address];
    }, userResponse.validationWindow * 1000);

    return res.status(200)
              .set("Content-Type", "application/json")
              .send(userResponse);
});

// POST /message-signature/validate
app.post('/message-signature/validate', async (req, res) => {
    // Validate the request body to check if it conforms to schema
    const result = validateRequest(req.body, signatureValidationSchema);

    let response = {
        status_code: null,
        status: null,
        reason: null,
    };

    // If request doesnt conform to schema, then send error as response
    if (result.error) {
        let reason = `Bad Request. ${result.error.details[0].message}`;
        response.status_code = 400;
        response.status = "Input Validation Failed.";
        response.reason = reason;
        return res.status(response.status_code)
                  .send(response);
    }

    // Request body is in correct conformation with schema.
    // 1. Check if signature validation request was made within validation window or not
    let address = req.body.address;
    signature = req.body.signature;
    let requestObject = requestCache[address];

    if (!requestObject) {
        response.status_code = 400;
        response.status = "Signature Validation Failed";
        response.reason = "Validation request was not made within validation window or the given " +
            "wallet address is invalid!";
        return res.status(response.status_code)
                  .send(response);
    }

    // 2. If request was made within validation window
    //verify the message using bitcoin functions and the provided signature and cached message
    if (validateSignature(requestObject.message, address, signature) !== true) {
        response.status_code = 400;
        response.status = "Signature Validation Failed";
        response.reason = "The provided credentials failed to sign the message!!";
        return res.status(response.status_code)
                  .send(response);
    }

    // 3. If message signature is correct then send user the required JSON response
    let time = new Date().getTime().toString().slice(0, -3);
    let timeElapsed = time - requestObject.requestTimeStamp;
    let newValidationWindow = 300 - timeElapsed;
    let userResponse = {
        registerStar: true,
        status: {
            address: address,
            requestTimeStamp: requestObject.requestTimeStamp,
            message: requestObject.message,
            validationWindow: newValidationWindow,
            messageSignature: "valid"
        }
    };

    return res.status(200)
              .set("Content-Type", "application/json")
              .send(userResponse);

});


// Starting Server
app.listen(PORT, () => {
    console.log(`Visit: http://localhost:${PORT}`);

});
