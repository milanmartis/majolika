export const environment = {
    production: false,
      strapiBaseUrl: 'https://majolika-cms.appdesign.sk',      // BEZ /api

      apiUrl: 'https://majolika-cms.appdesign.sk/api',      // Strapi base URL
    // apiUrl: 'http://localhost:1337/api',      // Strapi base URL
    // frontendUrl: 'https://staging.dxzvn9ta3v1he.amplifyapp.com',  
    frontendUrl: 'https://www.majolika.sk',  

    strapiToken: '3908c286d7c1435af8b3f9a2065257305b633bd1aa19df3eb6bfdea39cc5e13c81a099ded7446f2870a3e22672b149d15a40b9695294fc350c7b31803f5a1e80f2e0903ad2cdb2236d85dcb3748c6ff41590155a16b4a9bb86173ed2393e491b32d479620ee2dd9655d03c5f0f8b1d65eeeef9af3aefe5c7785a762373349d82',
    // tvoja Angular adresa
    googleClientId: '441769394651-f3themfnuvjggolen6q232am1fqi102q.apps.googleusercontent.com',
    PACKETA_WIDGET_KEY: '2874b47059f1e7fc',
    googleMapsApiKey: 'AIzaSyC57XSUvZIf3w9MJvA5pjfPxGlMY_jHZ70',
    allowedImageHosts: [
    'majolika.sk', // váš príklad
    // prípadne ďalšie presné domény
    'majolika-cms.appdesign.sk',
    'medusa-majolika-s3-us-east.s3.us-east-1.amazonaws.com',
    'https://d1hbdvlfav95nt.cloudfront.net',
   ],
turnstileSiteKey: '0x4AAAAAACso6LBnCMN9PM2Y',
  // povolené sufixy (match cez .endsWith)
   allowedImageHostSuffixes: [
    '.majolika.sk',
    '.amplifyapp.com',     // ľubovoľná Amplify subdoména
    '.cloudfront.net',     // CloudFront distribúcie
    '.s3.amazonaws.com',   // S3 „global-style“
    '.s3.eu-central-1.amazonaws.com', // S3 regionálny endpoint (upravte región)
  ],
  };