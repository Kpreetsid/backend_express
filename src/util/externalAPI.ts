import { externalAPI } from "../configDB";

export const getExternalData = async (path: string, body: any, token: string, userID: string) => {
  try {
    const apiUrl = `${externalAPI.URL}${path}`; 
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
        'X-User-Id': `${userID}`
      },
      body: JSON.stringify(body)
    });
    console.log(response);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (err: any) {
    console.error("Fetch error:", err.message);
    throw err;
  }
};
