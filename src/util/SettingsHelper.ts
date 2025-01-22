import localforage from "localforage";
import { settingsInfo } from "../ui/pages/Settings";

export const getSetting = async (key: string) => {
  const result = await localforage.getItem("settings_" + key);
  // Null fix
  if (result === null) {
    if (settingsInfo[key]) return settingsInfo[key].default;
    else return null;
  } else return result;
};

export const setSetting = async (key: string, value: any) => {
  return await localforage.setItem("settings_" + key, value);
};
