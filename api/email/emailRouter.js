const router = require('express').Router();
const bc = require('bcrypt');
const auth = require('./emailModel.js');
const nm = require('nodemailer');
const jwt = require('jsonwebtoken');
const hbs = require('nodemailer-express-handlebars');
const dotenv = require('dotenv');
dotenv.config();
const restricted = require('../middleware/restricted.js');
const jwtSecret = process.env.JWT_SECRET
const ses = require('nodemailer-ses-transport');

router.get('/activation/:email', async (req, res) => {
    return res.json(await auth.checkActivation(req.params.email));
})

router.post('/register', async (req, res) => {
    if (!req.body.email || !req.body.password || !req.body.username) {
        return res.status(400).json({ error: 'Username and Password are required.' });
    } 
    
    const { email, password, username, age, parentEmail } = req.body;

    const existingUser = await auth.getUserId(email);
    if (existingUser) {
        return res.status(400).json({ error: 'User already exists. Please sign in.' });
    }
    
    const combineForHash = email + password;
    const validationHash = bc.hashSync(combineForHash, 10);

    const newUser = {
        email,
        username,
        password: bc.hashSync(password, 10),
        age,
        parentEmail,
        validationUrl: validationHash,
    }
    await auth.addUser(newUser);
    
    let sendUrl = '';
    

    if(process.env.BE_ENV==="development"){
        sendUrl = `http://localhost:5000/email/activate/?token=${validationHash}&email=${email}`;

    }else {
        sendUrl = `https://ss-mvp.herokuapp.com/email/activate/?token=${validationHash}&email=${email}`;
    }

    // send email to parent instead of user, if given.
    // ToDo: change this to a separate ToS/PP confirmation email
    sendEmail(parentEmail || email, sendUrl);

    return res.status(200).json({ message: 'User created, waiting for validation.' })    
})

router.post('/login', async (req, res) => {
    if (req.body.email && req.body.password) {
        const { validated } = await auth.checkActivation(req.body.email);
        console.log(validated)

        auth.getUser(req.body.email).then(response => {
            console.log(response)
            if (validated === true) {
                if (bc.compareSync(req.body.password, response.password)) {
                    const token = signToken(response);
                    return res.status(201).json({ token });
                } else {
                    return res.status(400).json({ error: 'Incorrect login information.' })
                }
            } else {
                return res.status(400).json({ error: 'Your account must be validated.' })
            }
        })
        .catch(err => console.log(err));
        
    } else {
        return res.status(400).json({ error: 'Email and Password required for login.' })
    }
})

router.get('/activate', async (req, res) => {
    if (req.query.token) {
        const token = await auth.getToken(req.query.email);
        if (req.query.token === token.validationUrl) {
            // const activation = await auth.activateEmail(req.query.email, { validated: true });
            await auth.activateEmail(req.query.email, { validated: true });
            if(process.env.BE_ENV==="development"){
                res.redirect('http://localhost:3000/signin');
            }else {
                res.redirect('https://goofy-shirley-2a2ca3.netlify.app/signin');
                
            }
            // return res.status(200).json({ message: `${req.query.email} activation status = ${activation.validated}` });
        }
    } else {
        return res.status(400).json({ error: 'This token is invalid for activation.' })
    }
})

//this route is called when user activates email to issue a token so they can be automatically logged in
router.post('/activatedLogin', async (req, res)=>{
    const activatedUser = await auth.issueActivatedToken(req.body.token);
    console.log('body', req.body.token)
    console.log('activatedUser', activatedUser)
    if(activatedUser){
        let token = signToken(activatedUser)
        res.status(200).json({token: token})
    } else {
        res.status(400).json({message:'invalid token'})
    }

})

router.delete('/:email', (req, res) => {
    auth.getUserId(req.params.email)
    .then(async (response) => {
        if (response) {
            await auth.removeUser(response.id);
            return res.status(201).json({ message: 'user removed' })
        } else {
            res.status(400).json({ error: 'User does not exist.' })
        }
    })
    .catch(err => {
        console.log(err);
    });
})

function sendEmail(email, url) {

    const transporter = nm.createTransport(ses({
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY
    }));

    const handlebarOptions = {
        viewEngine: {
          extName: '.handlebars',
          partialsDir: './templates/',
          layoutsDir: './templates/',
          defaultLayout: 'email.handlebars',
        },
        viewPath: './templates/',
        extName: '.handlebars',
      };
    
    transporter.use('compile', hbs(handlebarOptions))

    transporter.sendMail({ 
        from: 'noreply@whatamido.in', 
        to: email, 
        subject: 'Activate your Story Squad account',
        context: {
            url: url
        },
        template: 'email'
    },(err, info) => {
        if (err) console.log(err);
        if (info) {
            console.log(info.envelope);
            console.log(info.messageId);
        }
    });
}

function signToken(user) {
    const payload = {
      username: user.email,
      id: user.id
    }
  
    const options = {
      expiresIn: '1d'
    }
  
    return jwt.sign(payload, jwtSecret, options);
}

module.exports = router;