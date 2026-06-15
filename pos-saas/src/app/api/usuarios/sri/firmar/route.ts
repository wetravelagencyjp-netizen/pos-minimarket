import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as forge from 'node-forge'
import { createHash, createSign } from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function c14n(xml: string): string {
  return xml.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}

function sha1b64(data: string): string {
  return createHash('sha1').update(data, 'utf8').digest('base64')
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function extraerCertificado(p12Base64: string, password: string) {
  const p12Der  = forge.util.decode64(p12Base64)
  const p12Asn1 = forge.asn1.fromDer(p12Der)
  const p12     = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password)

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
  const keyBag  = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
  if (!keyBag?.key) throw new Error('No se encontró la clave privada en el .p12')
  const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key)

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
  const certBag  = certBags[forge.pki.oids.certBag]?.[0]
  if (!certBag?.cert) throw new Error('No se encontró el certificado en el .p12')
  const cert    = certBag.cert
  const certDer = forge.util.encode64(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes())
  const issuer  = cert.issuer.attributes.map((a: any) => `${a.shortName}=${a.value}`).join(', ')
  const serial  = cert.serialNumber

  return { privateKeyPem, certDer, issuer, serial }
}

function firmarXAdESBES(xmlOriginal: string, privateKeyPem: string, certDer: string, issuer: string, serial: string): string {
  const sigId     = uid('Signature')
  const sigPropId = uid('SignedProperties')
  const certDigest = sha1b64(Buffer.from(certDer, 'base64').toString('binary'))
  const fechaFirma = new Date().toISOString()
  const docDigest  = sha1b64(c14n(xmlOriginal))

  const signedProps =
    `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="${sigPropId}">` +
    `<xades:SignedSignatureProperties>` +
    `<xades:SigningTime>${fechaFirma}</xades:SigningTime>` +
    `<xades:SigningCertificate><xades:Cert>` +
    `<xades:CertDigest>` +
    `<ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
    `<ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${certDigest}</ds:DigestValue>` +
    `</xades:CertDigest>` +
    `<xades:IssuerSerial>` +
    `<ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${issuer}</ds:X509IssuerName>` +
    `<ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${serial}</ds:X509SerialNumber>` +
    `</xades:IssuerSerial>` +
    `</xades:Cert></xades:SigningCertificate>` +
    `<xades:SignaturePolicyIdentifier><xades:SignaturePolicyImplied/></xades:SignaturePolicyIdentifier>` +
    `</xades:SignedSignatureProperties>` +
    `</xades:SignedProperties>`

  const propsDigest = sha1b64(c14n(signedProps))

  const signedInfo =
    `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
    `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
    `<ds:Reference URI="#comprobante">` +
    `<ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
    `<ds:DigestValue>${docDigest}</ds:DigestValue>` +
    `</ds:Reference>` +
    `<ds:Reference URI="#${sigPropId}" Type="http://uri.etsi.org/01903#SignedProperties">` +
    `<ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
    `<ds:DigestValue>${propsDigest}</ds:DigestValue>` +
    `</ds:Reference>` +
    `</ds:SignedInfo>`

  const signer = createSign('RSA-SHA1')
  signer.update(c14n(signedInfo), 'utf8')
  const signatureValue = signer.sign(privateKeyPem, 'base64')

  const signatureBlock =
    `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="${sigId}">` +
    signedInfo +
    `<ds:SignatureValue Id="SignatureValue-${sigId}">${signatureValue}</ds:SignatureValue>` +
    `<ds:KeyInfo><ds:X509Data><ds:X509Certificate>${certDer}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>` +
    `<ds:Object>` +
    `<xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="#${sigId}">` +
    `<xades:SignedProperties Id="${sigPropId}">${signedProps}</xades:SignedProperties>` +
    `</xades:QualifyingProperties>` +
    `</ds:Object>` +
    `</ds:Signature>`

  return xmlOriginal.replace(/(<\/factura>)\s*$/, `${signatureBlock}</factura>`)
}

function simularFirma(xmlOriginal: string): string {
  const sigSimulado =
    `<!-- FIRMA SIMULADA - Solo para pruebas. NO válida ante el SRI -->\n` +
    `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="Signature-SIMULADO">` +
    `<ds:SignedInfo>` +
    `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
    `<ds:Reference URI="#comprobante">` +
    `<ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
    `<ds:DigestValue>SIMULADO_DIGEST==</ds:DigestValue>` +
    `</ds:Reference></ds:SignedInfo>` +
    `<ds:SignatureValue>SIMULADO_SIGNATURE==</ds:SignatureValue>` +
    `<ds:KeyInfo><ds:X509Data><ds:X509Certificate>SIMULADO_CERT==</ds:X509Certificate></ds:X509Data></ds:KeyInfo>` +
    `</ds:Signature>`
  return xmlOriginal.replace(/(<\/factura>)\s*$/, `${sigSimulado}</factura>`)
}

export async function POST(request: NextRequest) {
  const logs: string[] = []
  const log = (msg: string) => { logs.push(`[${new Date().toISOString()}] ${msg}`); console.log(msg) }

  try {
    const { xml, comprobante_id, establecimiento_id } = await request.json()

    if (!xml) return NextResponse.json({ error: 'Se requiere el XML a firmar' }, { status: 400 })
    if (!establecimiento_id) return NextResponse.json({ error: 'Se requiere establecimiento_id' }, { status: 400 })

    log(`Iniciando firma — establecimiento=${establecimiento_id}`)

    const { data: cred, error: credError } = await supabaseAdmin
      .from('sri_credenciales')
      .select('certificado_p12, clave_certificado, ruc, tipo_emision')
      .eq('establecimiento_id', establecimiento_id)
      .single()

    if (credError || !cred) {
      log('ERROR: No se encontraron credenciales SRI')
      return NextResponse.json({ error: 'No hay credenciales SRI configuradas' }, { status: 400 })
    }

    const tieneCertificado = !!(cred.certificado_p12 && cred.clave_certificado)
    log(`Certificado p12: ${tieneCertificado ? '✓ encontrado' : '✗ no configurado (modo simulación)'}`)

    let xmlFirmado: string
    let simulado = false

    if (!tieneCertificado) {
      log('⚠ MODO SIMULACIÓN: firma no válida ante SRI')
      log('Para firma real: sube tu .p12 en Admin → Configuración SRI')
      xmlFirmado = simularFirma(xml)
      simulado   = true
    } else {
      log('Extrayendo certificado X.509...')
      const { privateKeyPem, certDer, issuer, serial } = extraerCertificado(cred.certificado_p12, cred.clave_certificado)
      log(`Emisor: ${issuer} | Serial: ${serial}`)
      log('Aplicando firma XAdES-BES...')
      xmlFirmado = firmarXAdESBES(xml, privateKeyPem, certDer, issuer, serial)
      log('✓ Firma XAdES-BES aplicada')
    }

    if (comprobante_id) {
      await supabaseAdmin
        .from('sri_comprobantes')
        .update({
          xml_firmado: xmlFirmado,
          fecha_firma: new Date().toISOString(),
          firmado_simulado: simulado,
          estado: simulado ? 'FIRMADO_SIMULADO' : 'FIRMADO',
        })
        .eq('id', comprobante_id)
      log('✓ XML firmado guardado en BD')
    }

    return NextResponse.json({ ok: true, xml_firmado: xmlFirmado, simulado, logs })

  } catch (e: any) {
    console.error('Error firma digital:', e)
    return NextResponse.json({ ok: false, error: 'Error en firma digital', detalle: e.message, logs }, { status: 500 })
  }
} 