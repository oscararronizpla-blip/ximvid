const admin = require('firebase-admin');
admin.initializeApp();

// ── Stripe Payment Flow ──────────────────────────────────────────
const stripeFlow = require('./stripe-payment-flow');
exports.createStripePaymentIntent = stripeFlow.createStripePaymentIntent;
exports.cancelStripeSubscription  = stripeFlow.cancelStripeSubscription;
exports.getStripeBillingPortal    = stripeFlow.getStripeBillingPortal;
exports.stripeWebhook             = stripeFlow.stripeWebhook;

// Email triggers (notificaciones por email via Gmail)
const emailTriggers = require('./email-triggers');
exports.onNotificationCreated = emailTriggers.onNotificationCreated;

// Compresion de video H.264 (estilo TikTok)
const videoProcessing = require('./video-processing');
exports.onVideoUploaded = videoProcessing.onVideoUploaded;

// Funciones de administracion (borrado definitivo, cambio de estado)
const adminDelete = require('./admin-delete');
exports.adminDeleteVideo  = adminDelete.adminDeleteVideo;
exports.adminDeleteUser   = adminDelete.adminDeleteUser;
exports.adminSetUserStatus = adminDelete.adminSetUserStatus;

// Resumen semanal de clics en redes (viernes 11h Madrid)
const weeklySummary = require('./weekly-summary');
exports.weeklySocialSummary = weeklySummary.weeklySocialSummary;

const viralRobot = require('./viral-robot');
exports.viralRobotNightly = viralRobot.viralRobotNightly;
exports.viralRobotRunNow  = viralRobot.viralRobotRunNow;

// Play Billing: validacion de compras de Google Play
const playBilling = require('./play-billing');
exports.verifyPlayPurchase = playBilling.verifyPlayPurchase;
