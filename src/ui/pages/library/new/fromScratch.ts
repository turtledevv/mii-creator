import localforage from "localforage";
import { MiiEditor, MiiGender } from "../../../../class/MiiEditor";
import Modal from "../../../components/Modal";
import { _shutdown, Library, newMiiId } from "../../Library";
import { miiCreateDialog } from "./_dialog";
import EditorIcons from "../../../../constants/EditorIcons";
import Html from "@datkat21/html";

export const newFromScratch = () => {
  function cb(gender: MiiGender) {
    return () => {
      _shutdown()();
      new MiiEditor(gender, async (m, shouldSave) => {
        if (shouldSave === true) await localforage.setItem(await newMiiId(), m);
        Library();
      });
    };
  }

  var m = Modal.modal(
    "Create New",
    "Select the Mii's gender",
    "body",
    {
      text: "Male",
      callback: cb(MiiGender.Male)
    },
    {
      text: "Female",
      callback: cb(MiiGender.Female)
    },
    {
      text: "Cancel",
      callback: () => miiCreateDialog()
    }
  );

  const genderMaleButton = m.qs(".modal-body button:nth-child(1)")!;
  const genderFemaleButton = m.qs(".modal-body button:nth-child(2)")!;
  if (genderMaleButton) {
    genderMaleButton.classOn("gender-select-btn");
    genderMaleButton.prepend(new Html("span").html(EditorIcons.genderMaleLg));
  }
  if (genderFemaleButton) {
    genderFemaleButton.classOn("gender-select-btn");
    genderFemaleButton.prepend(
      new Html("span").html(EditorIcons.genderFemaleLg)
    );
  }
};
