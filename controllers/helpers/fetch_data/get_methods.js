import fs from 'fs';
import {spawn} from 'child_process';

function get_methods(repo_owner, repo_name, path_methods, path_log, git_token) {
    console.log("GİRİSS");
    return new Promise((resolve, reject) => {
      
        var process = spawn('python3',["./controllers/methods_git.py", repo_owner, repo_name, git_token] );        
        fs.writeFileSync(path_methods, "")

        process.stdout.on('data', function(data) {
            var dataStr =  data.toString()
            console.log(dataStr);
            fs.appendFileSync(path_methods,  dataStr )
        } )    

        process.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
            fs.appendFileSync(path_log, data.toString())
        });
        
        process.stdout.on('close', (code) => {
            console.log("COMMITS: finished");
            fs.appendFileSync(path_log, "\nCOMMITS: Finished fetching")
            resolve(code);
        } ) 
    });
}

export { get_methods };
