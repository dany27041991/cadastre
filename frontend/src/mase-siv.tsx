/**
 * Single-SPA entry for @mase/siv microfrontend.
 * Exports bootstrap, mount, unmount for the root config.
 */
import React from "react";
import ReactDOMClient from "react-dom/client";
import singleSpaReact from "single-spa-react";
import type { AppProps } from "single-spa";
import AppRoot from "./app";
import { i18nReady } from "@/shared/i18n";
import { authService } from "@/app/auth/authService";
import "@/shared/styles/globals.css";

const lifecycles = singleSpaReact({
  React,
  ReactDOMClient,
  rootComponent: AppRoot,
  errorBoundary(err: Error, errInfo: React.ErrorInfo) {
    console.error("[mase-siv] Error boundary:", err, errInfo);
    return React.createElement("div", { role: "alert" }, "Application error.");
  },
});

export const { bootstrap } = lifecycles;

export async function mount(props: AppProps) {
  await i18nReady;
  authService.setUserFromProps(props);
  return lifecycles.mount(props);
}

export const { unmount } = lifecycles;
