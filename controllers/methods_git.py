import ast
from github import Github
from git import Repo
import shutil
import sys

print("HEREREERERERE")
repoOwner = sys.argv[1]
repoName = sys.argv[2]
git_token = sys.argv[3]
repo_owner_name = f"{repoOwner}/{repoName}"
repo_url = f'http://github.com/{repoOwner}/{repoName}.git'
githun_token = "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"

# directory for letting Perceval clone the git repo
repo_dir = f'./tmp/{repoOwner}_{repoName}_methods.git'

#repo_url = 'https://github.com/ceydas/exdev_test.git'
#repo_dir = 'C:/Users/leren/exdev-clone-repo'
selected_branch = 'main'
repo = Repo.clone_from(
    repo_url,
    repo_dir,
    branch = selected_branch
)


def reach_affecting_commits(file_name, start_line, end_line):
    import re
    import git
    dir_path = r'%s' % repo_dir
    g = git.Git(dir_path)
    commits_diff = g.log('-L', str(start_line) + "," + str(end_line) + ':' + file_name, '-p')
    print(commits_diff)
    commits_diff = commits_diff.split('\n')
    two_d_array = []
    for row in commits_diff:
        two_d_array.append(row.split())

    commits_shas = []
    for val in two_d_array:
        if len(val) == 2 and val[0] == 'commit':
            commits_shas.append(val[1])
            #rint(val[1])

    return commits_shas


g = Github(githun_token)
repo = g.get_repo(repo_owner_name)
#all commits that affects the specific branch
branch_commits = repo.get_commits(sha=selected_branch)
print(branch_commits)
commits_files = dict()
files_commits = dict()

#branch_commits.reversed only gives the first page of the github.paginatedList
#object. DON'T USE IT!!!!
size_of_commits_to_branch = 0
for i in branch_commits:
    size_of_commits_to_branch = size_of_commits_to_branch + 1 
    # print(i.commit.author.date)

branch_commits_shas = [None] * size_of_commits_to_branch
reversed_counter = size_of_commits_to_branch

for i in branch_commits:
    branch_commits_shas[reversed_counter - 1] = (i.sha,i.commit.author.date)
    reversed_counter = reversed_counter - 1
    #print(reversed_counter)

for i in branch_commits_shas:
    commits_files[i[0]] = list()


for i in branch_commits_shas:
    temp_files =  repo.get_commit(sha=i[0]).files
    for f in temp_files:
        if(f.filename[-1] == 'y' and f.filename[-2] == 'p' and f.filename[-3] == '.'):
            # print(f.filename)
            commits_files[i[0]].append(f.filename)

contents = repo.get_contents("")
#fileya su sha keyli commit atıldıktan sonraki hali
# contents = repo.get_contents("accounting/isbank/2022/sum-so-far.py", ref="5a76ae629af8a361dd237b141ff5c5895ab9bd14")
# print(contents.decoded_content.decode())
method_list = list()
method_commit_dictionary = dict()
#Python file paths --> key, list of the commits that affect python file --> value
python_file_paths = dict()
root_function_counter = 0
root_method_counter = 0

def methodToJson( file_content, function, key, className):

    if className == None:
        className = "Empty-Class"

    method_json = {
            "key": key,
            "filePath": file_content.path,
            "fileName": file_content.name,
            "className": className,
            "functionName": function.name,
            "startLineFun": function.lineno,
            "endLineFun": function.end_lineno,
            "isRootFun": "false",
            "commitShas": list(),
            "shaCreatorCommit": list()
        }
    method_list.append(method_json)


def rootMethodToJson(file_content, key, className):

    if className == None:
        className = "Empty-Class"
   
    method_json = {
            "key": key,
            "filePath": file_content.path,
            "fileName": file_content.name,
            "className": className,
            "functionName": "Root-Function",
            "startLineFun": 1,
            "endLineFun": file_content.size,
            "isRootFun": "true",
            "commitShas": list(),
            "shaCreatorCommit": list()
        }

    method_list.append(method_json)
    
    
while len(contents) > 0:
    file_content = contents.pop(0)
    if file_content.type == "dir":
        contents.extend(repo.get_contents(file_content.path))
    else:
        if(file_content.name[-1] == 'y' and file_content.name[-2] == 'p' and file_content.name[-3] == '.'):
            #print(file_content.decoded_content)
            # print(file_content.path)
            python_file_paths[file_content.path] = list()
            node = ast.parse(file_content.decoded_content)
            functions = [n for n in node.body if isinstance(n, ast.FunctionDef)]
            classes = [n for n in node.body if isinstance(n, ast.ClassDef)]
            root_function_counter = 0
            for function in functions:
                if root_function_counter == 0:
                    key = file_content.path + "/Empty-Class" + "/RootFunction"
                    rootMethodToJson(file_content, key, None)
                    root_function_counter = 1
                # print("File Path:", file_content.path)
                key = file_content.path + "/Empty-Class" + "/" +  function.name
                methodToJson(file_content, function, key, None)


            for class_ in classes:
                # print("Class name:", class_.name)
                methods = [n for n in class_.body if isinstance(n, ast.FunctionDef)]
                root_method_counter = 0
                for method in methods:
                    if root_method_counter == 0:
                        key = file_content.path + "/" + class_.name + "/RootFunction"
                        rootMethodToJson(file_content, key, class_.name)
                        root_method_counter = 1
                    key = file_content.path + "/" + class_.name + "/" + method.name
                    methodToJson(file_content, method, key, class_.name)



for path in python_file_paths:
    for i in commits_files:
        file_list = commits_files[i]
        for f in file_list:
            if f == path:
                python_file_paths[path].append(i)


# for i in python_file_paths:
#     print(i)
#     print(python_file_paths[i])
#     print("----------")

# for i in method_list:
#     print(method_list[i][3])


for f in python_file_paths:
    commit_list_temp = python_file_paths[f]
    for c in commit_list_temp:
        temp_content = repo.get_contents(f, c)
        node = ast.parse(temp_content.decoded_content)
        functions = [n for n in node.body if isinstance(n, ast.FunctionDef)]
        classes = [n for n in node.body if isinstance(n, ast.ClassDef)]
        for function in functions:
            temp_key_1 = f + "/Empty-Class" + "/" + function.name
            for tmp_method in method_list:
                if temp_key_1 == tmp_method["key"]:
                    if(len(tmp_method["shaCreatorCommit"]) == 0):
                        tmp_method["shaCreatorCommit"].append(c)
                    #tmp_method["commitShas"] = reach_affecting_commits(f, function.lineno, function.end_lineno)
                    break

        for class_ in classes:
            methods = [n for n in class_.body if isinstance(n, ast.FunctionDef)]
            for method in methods:
                temp_key_2 = f + "/" + class_.name + "/" + method.name
                for tmp_method in method_list:
                    if temp_key_2 == tmp_method["key"]:
                        if(len(tmp_method["shaCreatorCommit"]) == 0):
                            (tmp_method["shaCreatorCommit"]).append(c)
                        #tmp_method["commitShas"] = reach_affecting_commits(f, method.lineno, method.end_lineno)
                        break

print("Meth extraction complete.")

for tmp_method in method_list:
    if(tmp_method["functionName"] != "Root-Function"):
        tmp_method["commitShas"] = reach_affecting_commits(tmp_method["filePath"], tmp_method["startLineFun"], tmp_method["endLineFun"])

for tmp_method in method_list:
    if(tmp_method["functionName"] == "Root-Function"):
        method_list.remove(tmp_method)
import json

methods_dict = {"methods": method_list}

with open(f"../data/{repoOwner}/{repoName}/methods.json", "w") as outfile:
    # Write the JSON array of objects to the file object
    json.dump(methods_dict, outfile)
