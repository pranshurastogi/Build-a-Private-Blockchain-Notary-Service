
// Class will contain Wrapper functions for level DB in this class

// level DB for perm storage
const level = require('level');

module.exports = class BlockDAO {

    constructor(dbDir) {
        this.db = level(dbDir);
    }

    async getDb() {
        return this.db;
    }


    async saveBlock(key, block) {
        let _this = this;
        //let key = block.height;
        return new Promise(function(resolve, reject) {
            _this.db.put(key, block, function(err) {
                if(err) {
                    reject(new Error(`Block ${key} submission failed. ${err.message}`));
                }
                resolve(block);
            })
        });
    }

    // Get Hash of a block given blockHeight
    async getHashOfBlock(blockHeight) {
        let _this = this;
        //console.log(`Getting Hash of Block with height: ${blockHeight}`);
        return new Promise((resolve, reject) => {
            _this.db.get(blockHeight, function (err, value) {
                if (err) {
                    reject(err);
                } else {
                    let jsonValue = JSON.parse(value);
                    resolve(jsonValue.hash);
                }
            });
        });
    }


    async getBlock(key) {
        let _this = this;
        //return new Promise(function(resolve, reject) {
        return new Promise((resolve, reject) => {
            _this.db.get(key, function(err, value) {
                if (err) {
                    reject(new Error(`Can not get Block at key = ${key}. ${err.message}`));
                } else {
                    resolve(JSON.parse(value));
                }
            });
        });
    }


    // Get all stars from levelDB corresponding to a certain wallet address
    async starsOfWalletAddress(walletAddress) {
        let _this = this;
        let stars = [];
        let starObject;
        //console.log("inside DB.starsOfWalletAddress");
        return new Promise((resolve, reject) => {
            _this.db.createReadStream().on('data', function (data) {
                try {
                  starObject = JSON.parse(data.value.toString());
                  //console.log(starObject);
                }
                catch(e) {
                  console.log("parse exception:  ", e.stack);
                }
                if (starObject.body.address === walletAddress) {
                  stars.push(starObject);
                }
            }).on('error', function (err) {
                reject(err);
            }).on('close', function () {
                resolve(stars);
            });
        });
    }

    // Get star from levelDB given blockHash. One Star = One Block
    async starAgainstHash(blockHash) {
        let _this = this;
        let star = [];
        return new Promise((resolve, reject) => {
            _this.db.createReadStream().on('data', function (data) {
                let starObject = JSON.parse(data.value);
                //console.log("Hash from db:  ", starObject.hash);
                if (starObject.hash === blockHash) {
                    star.push(starObject);
                }
            }).on('error', function (err) {
                reject(err);
            }).on('close', function () {
                resolve(star);
            });
        });
    }


    async getChainLength() {
        let _this = this;
        return new Promise(function(resolve, reject){
            let length = 0;
            _this.db.createReadStream({ keys: true, values: false })
                .on('data', function (data) {
                    length++;
                })
                .on('error', function(err) {
                    reject(new Error(`Error in DB Read Stream. ${err.message}`));
                })
                .on('close', function(){
                    resolve(length);
                });
        });
    }


    async isEmpty() {
        let _this = this;
        return new Promise(function (resolve, reject) {
            let length = _this.getChainLength();
            length.then(result => {
                if(result === 0) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            }).catch(err => {
                reject(new Error(`Can not determine, if DB is empty. ${err.message}`));
            });
        });
    }

};
