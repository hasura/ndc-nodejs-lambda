// This file is hooked into mocha via .mocharc.json

import chai from "chai";
import chaiAsPromised from "chai-as-promised"

export const mochaGlobalSetup = function() {
  chai.use(chaiAsPromised);
};
