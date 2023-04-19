import fs from 'fs';
import fss from "fs/promises";

function sleep(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

const check_and_create_file = async (path) => {
    try {
        if (!fs.existsSync(path)) {
            await fss.writeFile(path, "", (err) => {
                if (err) {
                    console.log(err);
                }
            });
            return;
        }
    } catch (err) {
        console.error(err);
        return;
    }
}
export { sleep, check_and_create_file };


