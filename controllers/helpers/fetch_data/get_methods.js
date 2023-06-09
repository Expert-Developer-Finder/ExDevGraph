import fs from 'fs';
import {spawn} from 'child_process';

function get_methods(repo_owner, repo_name, path_methods, path_log, git_token, branch) {
    console.log("Methods are started to being fetched");
    return new Promise((resolve, reject) => {
      
        var process = spawn('python3',["./controllers/methods_git.py", repo_owner, repo_name, git_token, branch] );        
        fs.writeFileSync(path_methods, "")

        process.stdout.on('data', function(data) {
            var dataStr =  data.toString()
            fs.appendFileSync(path_methods,  dataStr )
        } )    

        process.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
            fs.appendFileSync(path_log, data.toString())
        });
        
        process.stdout.on('close', (code) => {
            console.log("METHODS: finished");
            fs.appendFileSync(path_log, "METHODS: Finished fetching\n")
            resolve(code);
        } ) 
    });
}

export { get_methods };
