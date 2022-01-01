const express = require('express')
const app = express()
const cors = require('cors');
require('dotenv').config();
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId
const stripe = require("stripe")(process.env.STRIPE_SECRETKEY);
const port = process.env.PORT || 5000;
const uuid = require("uuid");

app.use(cors());
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3fsfu.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


async function run() {
    try {
        await client.connect();
        const database = client.db('phjob')
        const usersCollection = database.collection('users');

        // registraion add user to database
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            console.log(result);
            res.json(result);
        });

        //check admin
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = '';
            if (user?.type ) {
                isAdmin = user.type;
            }
            res.json({ type: isAdmin });
        })

        // get all the users
        app.get('/users', async (req, res) => {
            const cursor = usersCollection.find({})
            const result = await cursor.toArray()
            const resWithoutAdmin = result.filter(obj=> obj.type !== 'admin')
            res.json(resWithoutAdmin)
        })

        // block or unblock user
        app.put('/users/', async (req, res) => {
            const user = req.body;
            let block = ''
            if(user.block_status === undefined || user.block_status === '' || user.block_status === null || user.block_status == 'false'){
                block = true
            }
            else{
                block = false
            }
            const filter = { _id: ObjectId(user._id) };
            const options = { upsert: true };
            const updateDoc = { $set: {block_status : block} };
            const result = await usersCollection.updateOne(filter, updateDoc, options );
            res.json(result);
        })

        // stripe
        app.post("/checkout", async (req, res) => {
          
            let error;
            let status;
            try {
              const { product, token } = req.body;
          
              const customer = await stripe.customers.create({
                email: token.email,
                source: token.id
              });
          
              const idempotency_key = uuid.v4();
              const charge = await stripe.charges.create(
                {
                  amount: product.price * 100,
                  currency: "usd",
                  customer: customer.id,
                  receipt_email: token.email,
                  description: `Purchased the ${product.name}`,
                  shipping: {
                    name: token.card.name,
                    address: {
                      line1: token.card.address_line1,
                      line2: token.card.address_line2,
                      city: token.card.address_city,
                      country: token.card.address_country,
                      postal_code: token.card.address_zip
                    }
                  }
                },
                {
                  idempotency_key
                }
              );
              console.log("Charge:", { charge });
              status = "success";
            } catch (error) {
              console.error("Error:", error);
              status = "failure";
            }
          
            res.json({ error, status });
          });
        
    }
    finally {
        // await client.close();
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello Job portal!')
})

app.listen(port, () => {
    console.log(`listening at ${port}`)
})