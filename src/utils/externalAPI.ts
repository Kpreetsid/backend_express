import { externalAPI } from "../configDB";
import axios, { AxiosRequestConfig } from "axios";
import { requireProcessorBaseUrl } from './processor-url';

const successStatusCode = [200, 201, 202, 203, 204, 205, 206, 207, 208, 226]
export const getExternalData = async (path: string, method: string, body: any, token: string, userID: string) => {
  try {
    console.group("External API");
    const baseUrl = requireProcessorBaseUrl(externalAPI.URL);
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const apiUrl = `${baseUrl}${normalizedPath}`;
    console.log({ apiUrl, userID });
    const config: AxiosRequestConfig = {
      method: method,
      url: apiUrl,
      headers: {
        "Content-Type": "application/json",
        "Authorization": token,
        "X-User-Id": userID
      },
      data: body,
      timeout: 3 * 60 * 1000, // 3 minutes timeout
    };
    const response = await axios(config);
    if (!successStatusCode.includes(response.status)) {
      throw new Error(`External API returned status code ${response.status}: ${response.statusText}`);
    }
    console.log({ method, status: response.status, statusText: response.statusText, data: response.data });
    console.groupEnd();
    return response.data;
  } catch (err: any) {
    console.error("❌ External API fetch error:", { message: err.message, name: err.name, stack: err.stack, });
    throw err;
  }
};
