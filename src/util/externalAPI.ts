import { externalAPI } from "../configDB";
import axios, { AxiosRequestConfig } from "axios";

export const getExternalData = async (path: string, method: string, body: any, token: string, userID: string) => {
  try {
    console.group("External API");
    const apiUrl = `${externalAPI.URL}${path}`;
    console.log({ apiUrl, body, token, userID });
    const config: AxiosRequestConfig = {
      method: method,
      url: apiUrl,
      headers: {
        "Content-Type": "application/json",
        "Authorization": token,
        "X-User-Id": userID,
        "X-Env": "true"
      },
      data: body,
      timeout: 60 * 1000, // 60s timeout
    };
    const response = await axios(config);
    if(response.status !== 200) {
      throw new Error(`External API returned status code ${response.status}: ${response.statusText}`);
    }
    console.log({ method, status: response.status, statusText: response.statusText, data: response.data?.data });
    console.groupEnd();
    return response.data;
  } catch (err: any) {
    console.error("❌ External API fetch error:", { message: err.message, name: err.name, stack: err.stack, });
    throw err;
  }
};