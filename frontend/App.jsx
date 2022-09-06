import { BrowserRouter } from "react-router-dom";
import { NavigationMenu } from "@shopify/app-bridge-react";
import Routes from "./Routes";

import {
  AppBridgeProvider,
  DiscountProvider,
  QueryProvider,
  PolarisProvider,
} from "./components";

export default function App() {
  // Any .tsx or .jsx files in /pages will become a route
  // See documentation for <Routes /> for more info
  let pages = import.meta.globEager("./pages/**/!(*.test.[jt]sx)*.([jt]sx)");

  // SATN
  let modulesPages = import.meta.globEager("./node_modules/**/frontend/pages/**/!(*.test.[jt]sx)*.([jt]sx)");
  pages = { ...modulesPages, ...pages };
  let devModulesPages = import.meta.globEager("./../app/**/frontend/pages/**/!(*.test.[jt]sx)*.([jt]sx)");
  pages = { ...devModulesPages, ...pages };
  const links = Object.keys(pages).filter(key => !key.includes('index') && !key.includes('NotFound')).map((key) => {
    let destination = key
      .replace(/\.\/\.\.\/app\/(.*)\/frontend\/pages/, "")
      .replace(/\.\/node_modules\/(.*)\/frontend\/pages/, "")
      .replace("./pages", "")
      .replace(/\.(t|j)sx?$/, "")
    let label = destination
      .replace('/', '')
      .replace(/\b[a-z]/, (firstLetter) => firstLetter.toUpperCase())

    return {
      destination,
      label,
    }
  });
  // /SATN

  return (
    <PolarisProvider>
      <BrowserRouter>
        <AppBridgeProvider>
          <DiscountProvider>
            <QueryProvider>
              <NavigationMenu
                navigationLinks={links}
              />
              <Routes pages={pages} />
            </QueryProvider>
          </DiscountProvider>
        </AppBridgeProvider>
      </BrowserRouter>
    </PolarisProvider>
  );
}
