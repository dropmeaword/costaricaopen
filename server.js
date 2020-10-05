
var nodemailer = require('nodemailer');
var postman = nodemailer.createTransport(
  'smtps://'+process.env.MAILJET_USERNAME+':'+process.env.MAILJET_PASSWORD+'@'+process.env.MAILJET_SMTP_RELAY
);

const SteinStore = require('stein-js-client')
const fs = require('fs');
const express = require('express')

// simplest database
const DB_FILENAME = 'timeslots.json'

// setup webapp runtime
const app = express()
app.use(express.static("public"));
app.use(express.urlencoded( {extended: true} ))

// use STEIN as our data-store
const store = new SteinStore(process.env.STEIN_SPREADSHEET_URL);


var emlbody = "";

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html")
})

app.get("/success", (req, res) => {
  res.sendFile(__dirname + "/views/success.html")
})

app.get("/failure", (req, res) => {
  res.sendFile(__dirname + "/views/failure.html")
})

app.get("/timeslots", (req, res) => {
  let rawdata = fs.readFileSync(DB_FILENAME);
  let timeslots = JSON.parse(rawdata)

  //console.log(timeslots)
  res.json(timeslots)
})

app.post("/book", (req, res) => {
  let rawdata = fs.readFileSync(DB_FILENAME);
  let timeslots = JSON.parse(rawdata)
  
  let value = timeslots["slots"][req.body.timeslot]["label_xls"] || "unknown"
  console.log("adding "+req.body.email+" to time slot -> " + value)

  // read email template from spreadsheet
  store.read("Content", { limit: 1 }).then(data => {
    emlbody = data[0]["email"]
    console.log("Fetched email template ok")
  });

  // store booking on spreadsheet
  store
    .append("Reserveringen", [
      {
        "tijdstip": value,
        "email": req.body.email
      }
    ])
    .then(result => {
      console.log("successfully added reservation to spreadsheet");
    
      // decrease 'left' counter and save file again
      let seatsleft = parseInt(timeslots["slots"][req.body.timeslot]["left"])
      console.log("visitors left for this timeslot -> " + seatsleft)
      timeslots["slots"][req.body.timeslot]["left"] =  seatsleft - 1
      console.log("updated value -> " + timeslots["slots"][req.body.timeslot]["left"])
      let data = JSON.stringify(timeslots);
      fs.writeFileSync(DB_FILENAME, data);
    
      // dispatch email
      /*///////// START - THE NODEMAILER PART ///////////*/
      let emltime = timeslots["slots"][req.body.timeslot]["label_eml"]
      if(-1 == emlbody.indexOf("%TIJDSTIP%") ) {
        console.log("Placeholder %TIJDSTIP% was not found in email body text")
      } else {
        emlbody = emlbody.replace("%TIJDSTIP%", emltime)
        console.log("Preparing email out to " + req.body.email +" -> " + emlbody)
      }

      // setup e-mail data
      var mailOptions = {
          from: '"Costa Rica Broedplaats" <'+process.env.EMAIL_SENDER+'>', // sender address
          to: req.body.email, // list of receivers
          subject: 'Je bezoek naar Costa Rica open ateliers', // Subject line
          text: emlbody
      };

      // send mail with defined transport object
      postman.sendMail(mailOptions, function(error, info){
          if(error){
              return console.log(error);
          }
          console.log('Message sent: ' + info.response);
      });
      /*///////// END - THE NODEMAILER PART ///////////*/
    
      return res.redirect('/success');
    })
    .catch(result => {
      console.log("something went wrong when updating the spreadsheet")
      console.log(result)
      return res.redirect('/failure');
    })
})

const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
})
