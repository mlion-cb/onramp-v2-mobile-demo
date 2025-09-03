# Welcome to the Onramp V2 Demo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Go to `/server/.env.example`, rename to `.env.local`
   
   Add in `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` from CDP Dev Portal   
2. Install dependencies on server dir
   
   ```bash
   chdir server && npm install
   ```
3. Run backend server
   
   ```bash
   npm run dev
   ```
4. Run on local Terminal
   ```bash
   ipconfig getifaddr en0
   ```
5. Replace `BASE_URL` value with IP obtained above on `/constants/BASE_URL`

   `http://<IP>:3000`
6. On a new terminal, install dependencies on root folder

   ```bash
   npm install
   ```

7. Start the app

   ```bash
   npx expo start
   ```

8. Scan the QR code on an iOS device with Expo Go installed


## One-click experience using Apple Widget:
`/components/onramp/ApplePayWidget.tsx`
* Render Payment Link as WebView
* Listen to post message Event [`onramp_api.load_success`] (https://docs.cdp.coinbase.com/onramp-&-offramp/onramp-apis/apple-pay-onramp-api).
* Inject CSS to hide button + click 
