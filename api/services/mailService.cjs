/**
 * @module mailService
 * @description Service d'envoi d'emails via Resend.
 * Utilisé notamment pour notifier les utilisateurs de la création de leur compte.
 */
const { Resend } = require('resend')
const { logError } = require('./loggerService.cjs')

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SITE_URL = process.env.SITE_URL || 'https://sitecaisse.vercel.app'

/** @type {Resend|null} Instance Resend singleton */
let resendClient = null

/**
 * Retourne l'instance Resend (singleton).
 * @returns {Resend|null} L'instance Resend, ou null si la clé API n'est pas configurée.
 */
function getResendClient() {
  if (resendClient) return resendClient
  if (!RESEND_API_KEY) {
    console.warn('⚠️  RESEND_API_KEY non configurée. Les emails ne seront pas envoyés.')
    return null
  }
  resendClient = new Resend(RESEND_API_KEY)
  return resendClient
}

/**
 * Envoie un email de notification de création de compte.
 * @param {Object} options - Options d'envoi.
 * @param {string} options.email - Adresse email du destinataire.
 * @param {string} options.nom - Nom de l'utilisateur.
 * @param {string} [options.password] - Mot de passe généré (optionnel, pour information).
 * @param {Object} [options.req] - Requête Express (pour les logs).
 * @returns {Promise<boolean>} true si l'email a été envoyé, false en cas d'échec ou si non configuré.
 */
async function sendAccountCreated({ email, nom, password, req } = {}) {
  const client = getResendClient()
  if (!client) return false

  try {
    const { data, error } = await client.emails.send({
      from: 'SiteCaisse <noreply@resend.dev>',
      to: [email],
      subject: 'Bienvenue sur SiteCaisse - Votre compte a été créé',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0; border-top: none; }
            .info-box { background: white; border: 1px solid #e0e0e0; border-radius: 6px; padding: 15px; margin: 15px 0; }
            .info-box p { margin: 5px 0; }
            .label { font-weight: bold; color: #555; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { margin-top: 20px; font-size: 12px; color: #999; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏪 SiteCaisse</h1>
              <p>Bienvenue sur l'application de gestion des ventes</p>
            </div>
            <div class="content">
              <p>Bonjour <strong>${nom}</strong>,</p>
              <p>Votre compte sur <strong>SiteCaisse</strong> a été créé avec succès.</p>
              <div class="info-box">
                <p><span class="label">📧 Email :</span> ${email}</p>
                ${password ? `<p><span class="label">🔑 Mot de passe :</span> <em>${password}</em></p>` : ''}
              </div>
              <p><strong>🔒 Important :</strong> Un changement de mot de passe vous sera demandé lors de votre première connexion.</p>
              <p style="text-align: center;">
                <a href="${SITE_URL}" class="cta-button">Accéder à SiteCaisse</a>
              </p>
            </div>
            <div class="footer">
              <p>Cet email est automatique, merci de ne pas y répondre.</p>
              <p>&copy; ${new Date().getFullYear()} SiteCaisse - Tous droits réservés</p>
            </div>
          </div>
        </body>
        </html>
      `,
    })

    if (error) {
      await logError({
        err: new Error(error.message),
        context: 'mail.account_created',
        cible_type: 'mail',
        details: { email, nom, error: error.message },
        req,
      })
      return false
    }

    return true
  } catch (err) {
    await logError({
      err,
      context: 'mail.account_created',
      cible_type: 'mail',
      details: { email, nom },
      req,
    })
    return false
  }
}

/**
 * Envoie un email de réinitialisation de mot de passe.
 * @param {Object} options - Options d'envoi.
 * @param {string} options.email - Adresse email du destinataire.
 * @param {string} options.nom - Nom de l'utilisateur.
 * @param {string} options.newPassword - Nouveau mot de passe généré.
 * @param {Object} [options.req] - Requête Express (pour les logs).
 * @returns {Promise<boolean>} true si l'email a été envoyé, false en cas d'échec ou si non configuré.
 */
async function sendPasswordReset({ email, nom, newPassword, req } = {}) {
  const client = getResendClient()
  if (!client) return false

  try {
    const { data, error } = await client.emails.send({
      from: 'SiteCaisse <noreply@resend.dev>',
      to: [email],
      subject: 'SiteCaisse - Votre mot de passe a été réinitialisé',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0; border-top: none; }
            .info-box { background: white; border: 1px solid #e0e0e0; border-radius: 6px; padding: 15px; margin: 15px 0; }
            .info-box p { margin: 5px 0; }
            .label { font-weight: bold; color: #555; }
            .warning-box { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 15px 0; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { margin-top: 20px; font-size: 12px; color: #999; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔑 SiteCaisse</h1>
              <p>Réinitialisation de votre mot de passe</p>
            </div>
            <div class="content">
              <p>Bonjour <strong>${nom}</strong>,</p>
              <p>Un administrateur a réinitialisé votre mot de passe sur <strong>SiteCaisse</strong>.</p>
              <div class="info-box">
                <p><span class="label">📧 Email :</span> ${email}</p>
                <p><span class="label">🔑 Nouveau mot de passe :</span> <strong>${newPassword}</strong></p>
              </div>
              <div class="warning-box">
                <p><strong>⚠️ Important :</strong></p>
                <p>Un changement de mot de passe vous sera obligatoirement demandé lors de votre prochaine connexion.</p>
              </div>
              <p style="text-align: center;">
                <a href="${SITE_URL}" class="cta-button">Accéder à SiteCaisse</a>
              </p>
            </div>
            <div class="footer">
              <p>Cet email est automatique, merci de ne pas y répondre.</p>
              <p>&copy; ${new Date().getFullYear()} SiteCaisse - Tous droits réservés</p>
            </div>
          </div>
        </body>
        </html>
      `,
    })

    if (error) {
      await logError({
        err: new Error(error.message),
        context: 'mail.password_reset',
        cible_type: 'mail',
        details: { email, nom, error: error.message },
        req,
      })
      return false
    }

    return true
  } catch (err) {
    await logError({
      err,
      context: 'mail.password_reset',
      cible_type: 'mail',
      details: { email, nom },
      req,
    })
    return false
  }
}

module.exports = { sendAccountCreated, sendPasswordReset }
