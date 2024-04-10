import { fileAChildFunction as renamedFileAChildFunction } from "./file-a"
import { fileBChildFunction1, fileBChildFunction2 } from "./file-b"

export {
  renamedFileAChildFunction,
  fileBChildFunction1,
  fileBChildFunction2 as renamedFileBChildFunction2
};
