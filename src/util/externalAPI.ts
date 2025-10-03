import { externalAPI } from "../configDB";
import axios, { AxiosRequestConfig } from "axios";

export const getExternalData = async (path: string, body: any, token: string, userID: string) => {
  try {
    const apiUrl = `${externalAPI.URL}${path}`;
    console.log("🌍 Calling external API:", apiUrl);
    const config: AxiosRequestConfig = {
      method: "POST",
      url: apiUrl,
      headers: {
        "Content-Type": "application/json",
        "Authorization": token,
        "X-User-Id": userID,
        "X-Env": "true",
      },
      data: body,
      timeout: 60 * 1000, // 60s timeout
    };
    const response = await axios(config);
    if(response.status !== 200) {
      throw new Error(`External API returned status code ${response.status}: ${response.statusText}`);
    }
    return response.data;
  } catch (err: any) {
    console.error("❌ External API fetch error:", { message: err.message, name: err.name, stack: err.stack, });
    throw err;
  }
};