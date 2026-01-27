const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const emailService = {
  sendVerificationEmail: async (email, token) => {
    const verficationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;

    const mailoption = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Verify your Email - Ecom App",
      html: `
        <h1>Email verfication</h1>
        <p>Please clink link below to verfiy your email address:</p>
        <a> href="${verficationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
        <p>This will expire in 24 hours.</p>
        <p>If you didn't create an account, please ignore this email.</p>
        `,
    };

    await transporter.sendMail(mailoption);
  },

  sendPasswordResetEmail: async (email, token) => {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;

    const mailoption = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Reset Your Password - Ecommerce App",
      html: `<h1>Password Reset</h1>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        `,
    };

    await transporter.sendMail(mailoption);
  },
};

module.exports = emailService;
