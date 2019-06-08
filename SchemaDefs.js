const Joi = require('joi');
const bitcoinMessage = require('bitcoinjs-message');

const blockSchema = {
    body: Joi.string().min(3).required()
};

const requestValidationSchema = {
    address: Joi.string().min(10).max(34).required()
};

const signatureValidationSchema = {
    address: Joi.string().min(10).max(34).required(),
    signature: Joi.string().max(88).required()
};

const starRegistrationSchema = {
    address: Joi.string().min(10).max(34).required(),
    star: Joi.object().keys({
                                dec: Joi.string().min(3).required(),
                                ra: Joi.string().min(3).required(),
                                magnitude: Joi.string().min(3),
                                constellation: Joi.string().min(3),
                                story: Joi.string().min(3).regex(/[a-zA-Z0-9]/).required()
                            })
};

// Validate Function to validate incoming POST requests
function validateRequest(body, schemaToValidateAgainst) {
    return Joi.validate(body, schemaToValidateAgainst);
}

// This function returns the hex encoded ascii string
function asciiToHexa(str) {
    let arr1 = [];
    for (let n = 0, l = str.length; n < l; n++) {
        let hex = Number(str.charCodeAt(n)).toString(16);
        arr1.push(hex);
    }
    return arr1.join('');
}

function hexaToAscii(str1) {
    let hex = str1.toString();
    let str = '';
    for (let n = 0; n < hex.length; n += 2) {
        str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
    }
    return str;
}

// function to validate messageSignature
function validateSignature(message, address, signature) {
    try {
        return bitcoinMessage.verify(message, address, signature);
    } catch (e) {
        return e.message;
    }
}

// validate if string has only ASCII characters
function isAsciiOnly(str) {
    console.log("Story is:   ", str, str.length)
    let retval = true;
    for (let i = 0; i<str.length; i++)
        if (str.charCodeAt(i) > 127)
            retval = false;
    return retval;
}


module.exports = {
    blockSchema,
    validateSignature,
    requestValidationSchema,
    signatureValidationSchema,
    validateRequest,
    starRegistrationSchema,
    asciiToHexa,
    hexaToAscii
};
