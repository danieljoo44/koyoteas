/* KOYO — shop page */
import { initSite } from "./common.js";
import { initShop } from "./shop.js";

const site = initSite();
if (site) initShop({ lenis: site.lenis });
