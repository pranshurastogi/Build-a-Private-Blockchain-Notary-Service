# Build-a-Private-Blockchain-Notary-Service


## What will you need to do?
Create a Blockchain dataset that allow you to store a Star (You should have this done in Projects 2 and 3)

The application will persist the data (using LevelDB).
The application will allow users to identify the Star data with the owner.
Create a Mempool component
```
The mempool component will store temporal validation requests for 5 minutes (300 seconds).
The mempool component will store temporal valid requests for 30 minutes (1800 seconds).
The mempool component will manage the validation time window.
Create a REST API that allows users to interact with the application.
```
```
The API will allow users to submit a validation request.
The API will allow users to validate the request.
The API will be able to encode and decode the star data.
The API will allow be able to submit the Star data.
The API will allow lookup of Stars by hash, wallet address, and height.
```
## Framework used

Express.js

## Getting started

Open a command prompt or shell terminal after install node.js and execute:

```
npm install
```

## Testing

```
npm test
```
