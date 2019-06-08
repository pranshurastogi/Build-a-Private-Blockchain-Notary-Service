
const SHA256 = require('crypto-js/sha256');
const Block = require('./Block');


//Actual blockchain class - will be exposed as SERVICE to the controller class for encapsulating the functionality
class Blockchain {

    constructor(db){
        console.log('inside constructor ..... ');
        this.chain = db;
        this.chain.isEmpty().then(result => {
            if(result) {
                console.log("Blockchain DB is empty. Creating new Blockchain with 1 genesis block...");
                this.addBlock(new Block("First block in the chain - Genesis block"));
            } else {
                console.log("Blockchain DB has blocks. Reading Blockchain from DB...");
            }
        }).catch(err => {
            throw err;
        });
    }

    async getChain() {
        return this.chain;
    }


    // Add new block
    async addBlock(newBlock) {
        try {
            let chainLength = await this.getBlockHeight();
            // Block height
            //console.log(`Length is ${chainLength}`);
            newBlock.height = chainLength;
            // UTC timestamp
            newBlock.time = new Date().getTime().toString().slice(0, -3);

            if (chainLength > 0) {
                try {
                    newBlock.previousBlockHash = await this.chain.getHashOfBlock(chainLength - 1);
                } catch (e) {
                    console.log(e.message);
                    return;
                }
            }
            // Block hash with SHA256 using newBlock and converting to a string
            newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();
            // Adding block object to chain
            await this.chain.saveBlock(newBlock.height,JSON.stringify(newBlock).toString());
            console.log(`Block Added:: Height is:  `, chainLength);
            return newBlock;
        } catch (e) {
            console.log(e);
        }
    }

    // Get block height
    async getBlockHeight() {
        try {
            let height = await this.chain.getChainLength();
            return height;
        } catch (e) {
            return e;
        }
    }

    // GET block
    async getBlock(blockHeight) {
        try {
            let block = await this.chain.getBlock(blockHeight);
            return block;
        } catch (e) {
            console.log(e.message);
        }
    }

    // GET all stars for a certain wallet address
    async getAllStarsOfWallet(walletAdress) {
        try {
            let stars = await this.chain.starsOfWalletAddress(walletAdress);
            return stars;
        } catch (e) {
            console.log("getAllStarsOfWallet ===>  ", e.stack);
        }
    }

    // GET the star given a certain blockHash
    async getStarAgainstHash(blockHash) {
        try {
            let hash_stars = await this.chain.starAgainstHash(blockHash);
            return hash_stars;
        } catch (e) {
            console.log(e.stack);
        }

    }

    // validate block
    async validateBlock(blockHeight) {

        return new Promise(async (resolve, reject) => {

            // get block object
            let block = await this.getBlock(blockHeight);
            block = JSON.parse(block);

            // get block hash
            let blockHash = block.hash;
            // remove block hash to test block integrity
            block.hash = '';
            // generate block hash
            let validBlockHash = SHA256(JSON.stringify(block)).toString();
            // Compare
            if (blockHash === validBlockHash) {
                resolve(true);
            } else {
                console.log('Block #' + blockHeight + ' invalid hash:\n' + blockHash + '<>' + validBlockHash);
                resolve(false);
            }

        });

    }

    // Validate blockchain
    async validateChain() {
        let errorLog = [];
        let chainLength = await this.getBlockHeight() + 1;
        for (let i = 0; i < chainLength; i++) {
            // validate block
            let validStatus = await this.validateBlock(i);
            if (!validStatus) {
                errorLog.push(i);
            }

            if (i < chainLength - 1) {

                // compare blocks hash link
                let block = await this.getBlock(i);
                block = JSON.parse(block);
                let blockHash = block.hash;

                let prevBlock = await this.getBlock(i + 1);
                prevBlock = JSON.parse(prevBlock);
                let prevBlockHash = prevBlock.previousBlockHash;

                if (blockHash !== prevBlockHash) {
                    errorLog.push(i);
                }
            }

        }
        if (errorLog.length > 0) {
            console.log('Block errors = ' + errorLog.length);
            console.log('Blocks: ' + errorLog);
        } else {
            console.log('No errors detected');
        }
    }
}
module.exports = Blockchain;
