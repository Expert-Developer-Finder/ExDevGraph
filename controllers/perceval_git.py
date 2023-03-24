import shutil
import json
import sys
from perceval.backends.core.git import Git

repoOwner = sys.argv[1]
repoName = sys.argv[2]
path_commits = sys.argv[3]
path_log = sys.argv[4]

# print(repoOwner)
# print(repoName)
# print(path_commits)
# print(path_log)

# open the already created file
# f_commits = open(path_commits, "w")

# url for the git repo to analyze
repo_url = f'http://github.com/{repoOwner}/{repoName}.git'
    
# directory for letting Perceval clone the git repo
repo_dir = f'./tmp/{repoOwner}_{repoName}.git'

# create a Git object, pointing to repo_url, using repo_dir for cloning
repo = Git(uri=repo_url, gitpath=repo_dir)
    
# fetch all commits as an iterator, and iterate it printing each hash
for commit in repo.fetch():
    json_object = json.dumps(commit,  separators=(',', ': '))
    # f_commits.write (json_object + "\n")
    print(json_object )

        
# Delete the temporarily created folder
shutil.rmtree(repo_dir)
sys.exit(0)



