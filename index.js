const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion } = require('mongodb')
const jwt = require('jsonwebtoken')
const morgan = require('morgan')
const port = process.env.PORT || 8000

// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())
app.use(morgan('dev'))
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  console.log(token)
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}

const client = new MongoClient(process.env.DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})
async function run() {
  try {
    const usersCollection = client.db('building-management').collection('users')
    const roomsCollection = client.db('building-management').collection('rooms')
    const bookingsCollection = client.db('building-management').collection('bookings')
    const announcementCollection = client.db('building-management').collection('announcement')
    // auth related api
    app.post('/jwt', async (req, res) => {
      const user = req.body
      console.log('I need a new jwt', user)
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })


        // Get all rooms
    app.get('/rooms', async (req, res) => {
        const result = await roomsCollection.find().toArray()
        res.send(result)
      })

      // Endpoint to handle saving booking data
      app.post('/bookings', async (req, res) => {
        try {
          const bookingData = req.body;
      
          if (!bookingData) {
            return res.status(400).json({ success: false, message: 'Invalid booking data' });
          }
      
          const result = await bookingsCollection.insertOne(bookingData);
      
          if (!result || !result.ops || result.ops.length === 0) {
            return res.status(500).json({ success: false, message: 'Error saving booking data' });
          }
      
          res.status(201).json({ success: true, data: result.ops[0] });
        } catch (error) {
          console.error('Error:', error);
          res.status(500).json({ success: false, message: 'Error saving booking data' });
        }
      });
      

      app.get('/getBookings', async (req, res) => {
        const result = await bookingsCollection.find().toArray()
        res.send(result)
      })


      app.get('/getBookings/:email', verifyToken,  async (req, res) => {
        const email = req.params.email
        const result = await bookingsCollection
          .findOne({ 'email': email })
          
        res.send(result)
      })


      // Save a room in database
    app.post('/announcement', verifyToken, async (req, res) => {
        const room = req.body
        const result = await announcementCollection.insertOne(room)
        res.send(result)
      })

      app.get('/getAnnouncement', async (req, res) => {
        const result = await announcementCollection.find().toArray()
        res.send(result)
      })


    // Logout
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
        console.log('Logout successful')
      } catch (err) {
        res.status(500).send(err)
      }
    })

    // Save or modify user email, status in DB
    app.put('/users/:email', async (req, res) => {
      const email = req.params.email
      const user = req.body
      const query = { email: email }
      const options = { upsert: true }
      const isExist = await usersCollection.findOne(query)
      console.log('User found?----->', isExist)
      if (isExist) return res.send(isExist)
      const result = await usersCollection.updateOne(
        query,
        {
          $set: { ...user, timestamp: Date.now() },
        },
        options
      )
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from building-management Server..')
})

app.listen(port, () => {
  console.log(`building-management is running on port ${port}`)
})
