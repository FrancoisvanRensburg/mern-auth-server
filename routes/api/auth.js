const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const sgMail = require('@sendgrid/mail');
const User = require('../../models/user');
require('dotenv').config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const { userSignupValidator } = require('../../validators/auth');
const { runValidation } = require('../../validators');

router.post('/signup', userSignupValidator, runValidation, async (req, res) => {
  const { name, email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      if (user) {
        return res
          .status(400)
          .json({ errors: [{ msg: 'User already exists' }] });
      }
    }
    const token = jwt.sign(
      { name, email, password },
      process.env.JWT_ACCOUNT_ACTIVATION,
      { expiresIn: 7200 }
    );

    const emailData = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Account activation link`,
      html: `<h1>Please use the following link to activate your account</h1>
                <p>${process.env.CLIENT_URL}/auth/activate/${token}</p>
                <hr />
                <p>This email may contain sensetive information</p>
                <p>${process.env.CLIENT_URL}</p>
            `,
    };

    sgMail.send(emailData);
    res.json({
      message: `Email has been sent to ${email}. Follow the instruction to activate your account`,
    });
  } catch (error) {
    if (error) {
      console.error(error.message);
      res.status(500).send('Server Error');
    }
  }
});

router.post('/account-activation', async (req, res) => {
  const { token } = req.body;
  try {
    if (token) {
      jwt.verify(token, process.env.JWT_ACCOUNT_ACTIVATION, function (
        err,
        decoded
      ) {
        if (err) {
          console.log('JWT VERIFY IN ACCOUNT ACTIVATION ERROR', err);
          return res.status(401).json({
            error: 'Expired link. Signup again',
          });
        }

        const { name, email, password } = jwt.decode(token);

        const user = new User({ name, email, password });

        user.save((err, user) => {
          if (err) {
            console.log('SAVE USER IN ACCOUNT ACTIVATION ERROR', err);
            return res.status(401).json({
              error: 'Error saving user in database. Try signup again',
            });
          }
          return res.json({
            message: 'Signup success. Please signin.',
          });
        });
      });
    } else {
      return res.json({
        message: 'Something went wrong. Try again.',
      });
    }
  } catch (error) {
    if (error) {
      console.error(error.message);
      res.status(500).send('Server Error');
    }
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ errors: [{ msg: 'Invalid email address' }] });
    }

    if (!user.authenticate(password)) {
      return res
        .status(400)
        .json({ errors: [{ msg: 'Email and password do not match' }] });
    }

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: 360000,
    });
    const { _id, name, role } = user;

    return res.json({
      token,
      user: { _id, name, email, role },
    });
  } catch (error) {
    if (error) {
      console.error(error.message);
      res.status(500).send('Server Error');
    }
  }
});

module.exports = router;
