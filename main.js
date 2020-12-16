/* -------------------------------------------------------------------------- */
//                     ######## LOAD LIBRARIES ########
/* -------------------------------------------------------------------------- */
//#region 

const express = require('express')
const secure = require('secure-env')
const morgan = require('morgan')
const cors = require('cors')

const { Timestamp, MongoClient} = require('mongodb')
const mysql = require('mysql2/promise')
// const AWS = require('aws-sdk')
// const multer = require('multer')
const fs = require('fs')

//#endregion



/* -------------------------------------------------------------------------- */
//             ######## DECLARE VARIABLES & CONFIGURATIONS ########
/* -------------------------------------------------------------------------- */
//#region

// RETREIVE ENV VARIABLES
global.env = secure({secret: process.env.ENV_PASSWORD})

// PORT FOR SERVER TO LISTEN TO
const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3000

// MONGODB VARIABLES ## -- CAN BE SHIFTED TO GLOBAL.ENV
const MONGO_URL = global.env.MONGO_URL
const MONGO_USER = global.env.MONGO_USER
const MONGO_PASS = global.env.MONGO_PASS
const MONGO_DB = global.env.MONGO_DB
const MONGO_COLLECTION = global.env.MONGO_COLLECTION

// DIGITALOCEAN S3 VARIABLES
// const AWS_ENDPOINT = new aws.Endpoint(global.env.DIGITALOCEAN_ENDPOINT)

/* -------------------------------------------------------------------------- */
//                      ######### CONFIGURATIONS #######
/* -------------------------------------------------------------------------- */


// S3 CONFIGURATIONS <- env variables can be shifted to .env
// const s3 = new AWS.S3({
//     endpoint: AWS_ENDPOINT,
//     accessKeyId: global.env.DIGITALOCEAN_ACCESS_KEY,
//     secretAccessKey: global.env.DIGITALOCEAN_SECRET_ACCESS_KEY
// })

// MONGO CONFIUGRAIONS
const mongo = new MongoClient(MONGO_URL,
    {
        useNewUrlParser: true, useUnifiedTopology: true
    }
)

// MYSQL CONFIGURATIONS 
const pool = mysql.createPool({
    host: global.env.SQL_HOST,
    port: global.env.SQL_PORT,
    user: global.env.SQL_USER,
    password: global.env.SQL_PASS,
    database: global.env.SQL_SCHEMA,
    connectionLimit: global.env.SQL_CON_LIMIT
})

// SERVER CONFIGURATIONS
const app = express()
// const upload = multer()
// const upload = multer({dest: `${__dirname}/uploads/`})

//#endregion



/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */



/* -------------------------------------------------------------------------- */
//                          ######## METHODS ########
/* -------------------------------------------------------------------------- */
//#region

// Boilerplate for making SQL queries
const mkQuery = (SQL, POOL) => {
    return async (PARAMS) => {
        // get a connection from pool
        const conn = await POOL.getConnection()
        try {
            // Execute the query
            const results = await conn.query(SQL, PARAMS)
            return results[0]
        } catch (e) {
            return Promise.reject(e)
        } finally {
            conn.release()
        }
    }
}

/* -------------------------------------------------------------------------- */

//#endregion



/* -------------------------------------------------------------------------- */
//                        ######## SQL QUERIES ########
/* -------------------------------------------------------------------------- */
//#region

const SQL_SELECT_WITH_ID = "SELECT gid,name,year,url,image FROM `game` WHERE gid = ?"

// SQL STATEMENTS
const QUERY_SELECT_WITH_ID = mkQuery(SQL_SELECT_WITH_ID, pool)

//#endregion



/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */



/* -------------------------------------------------------------------------- */
//                          ######## REQUESTS ########
/* -------------------------------------------------------------------------- */
//#region 

// Log incoming requests using morgan
app.use(morgan('combined'))

// Apply cors headers to resp
app.use(cors())



// GET /game/:id 
app.get('/game/:id', async (req, resp) => {
    const id = req.params.id
    const results = Object.assign({},(await QUERY_SELECT_WITH_ID(id))[0])
    const reviews = await mongo.db(MONGO_DB).collection(MONGO_COLLECTION).aggregate([
        {
            $match : {name: results.name}
        }
        
    ])
    .limit(10)
    .toArray()
    results.reviews = reviews;
    resp.type('application/json')
    resp.status(200)
    resp.json(results)
})



//#endregion



/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */



/* -------------------------------------------------------------------------- */
//                    ######## INITIALISING SERVER ########
/* -------------------------------------------------------------------------- */
//#region 

// Tests the mongo server
const checkMongo = () => {
    try {
        console.info("Pinging Mongo in progress...")
        return mongo.connect()
        .then (() => {
            console.info("Pinging Mongo is succesful...")
            return Promise.resolve()
        })
    } catch (e) {
        return Promise.reject(e)
    }
}

// Tests the MYSQL server
const checkMYSQL = () => {
    try {
        return pool.getConnection()
        .then ((conn) => {
            console.info("Pinging MYSQL in progress...")
            conn.ping()
            return conn
        })
        .then ((conn) => {
            conn.release()
            console.info("Pinging MYSQL is successful...")
            return Promise.resolve()
        })
    } catch (e) {
        return Promise.reject(e)
    }
}

// Tests the AWS server
const checkAWS = () => new Promise((resolve, reject) => {
    // if (!!global.env.DIGITALOCEAN_ACCESS_KEY && !!global.env.DIGITALOCEAN_SECRET_ACCESS_KEY) {
    //     console.info("AWS keys found...")
    //     resolve()
    // }
    // else
    //     reject('S3 Key is not found.')
    resolve()
})

// Runs all tests before starting server
Promise.all([checkMongo(), checkMYSQL(), checkAWS()])
.then (() => {
    app.listen(PORT, () => {
        console.info(`Application is listening PORT ${PORT} at ${new Date()}`)
    })
}).catch (e => {
    console.info("Error starting server: ",  e)
})

//#endregion



/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */