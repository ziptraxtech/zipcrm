import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../configs/api";



// A failed request is reported as an error rather than an empty list, so the app can tell
// "this person has no workspace" apart from "the API is down".
export const fetchWorkspaces = createAsyncThunk('workspace/fetchWorkspaces', async ({ getToken }, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/api/workspaces', {headers: { Authorization: `Bearer ${await getToken()}` }})
      return data.workspaces || []
    } catch (error) {
      return rejectWithValue(error?.response?.data?.message || error.message)
    }
  }
);

const initialState = {
    workspaces: [],
    currentWorkspace: null,
    loading: false,
    loaded: false, // true once the first fetch has finished, successfully or not
    error: null,
};

const workspaceSlice = createSlice({
    name: "workspace",
    initialState,
    reducers: {
        setWorkspaces: (state, action) => {
            state.workspaces = action.payload;
        },
        setCurrentWorkspace: (state, action) => {
            localStorage.setItem("currentWorkspaceId", action.payload);
            state.currentWorkspace = state.workspaces.find((w) => w.id === action.payload);
        },
        addWorkspace: (state, action) => {
            state.workspaces.push(action.payload);

            // set current workspace to the new workspace
            if (state.currentWorkspace?.id !== action.payload.id) {
                state.currentWorkspace = action.payload;
            }
        },
        updateWorkspace: (state, action) => {
            state.workspaces = state.workspaces.map((w) =>
                w.id === action.payload.id ? action.payload : w
            );

            // if current workspace is updated, set it to the updated workspace
            if (state.currentWorkspace?.id === action.payload.id) {
                state.currentWorkspace = action.payload;
            }
        },
        deleteWorkspace: (state, action) => {
            state.workspaces = state.workspaces.filter((w) => w._id !== action.payload);
        },
        addProject: (state, action) => {
            state.currentWorkspace.projects.push(action.payload);
            // find workspace by id and add project to it
            state.workspaces = state.workspaces.map((w) =>
                w.id === state.currentWorkspace.id ? { ...w, projects: w.projects.concat(action.payload) } : w
            );
        },
        addTask: (state, action) => {

            state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) => {
                console.log(p.id, action.payload.projectId, p.id === action.payload.projectId);
                if (p.id === action.payload.projectId) {
                    p.tasks.push(action.payload);
                }
                return p;
            });

            // find workspace and project by id and add task to it
            state.workspaces = state.workspaces.map((w) =>
                w.id === state.currentWorkspace.id ? {
                    ...w, projects: w.projects.map((p) =>
                        p.id === action.payload.projectId ? { ...p, tasks: p.tasks.concat(action.payload) } : p
                    )
                } : w
            );
        },
        updateTask: (state, action) => {
            state.currentWorkspace.projects.map((p) => {
                if (p.id === action.payload.projectId) {
                    p.tasks = p.tasks.map((t) =>
                        t.id === action.payload.id ? action.payload : t
                    );
                }
            });
            // find workspace and project by id and update task in it
            state.workspaces = state.workspaces.map((w) =>
                w.id === state.currentWorkspace.id ? {
                    ...w, projects: w.projects.map((p) =>
                        p.id === action.payload.projectId ? {
                            ...p, tasks: p.tasks.map((t) =>
                                t.id === action.payload.id ? action.payload : t
                            )
                        } : p
                    )
                } : w
            );
        },
        deleteTask: (state, action) => {
            state.currentWorkspace.projects.map((p) => {
                p.tasks = p.tasks.filter((t) => !action.payload.includes(t.id));
                return p;
            });
            // find workspace and project by id and delete task from it
            state.workspaces = state.workspaces.map((w) =>
                w.id === state.currentWorkspace.id ? {
                    ...w, projects: w.projects.map((p) =>
                        p.id === action.payload.projectId ? {
                            ...p, tasks: p.tasks.filter((t) => !action.payload.includes(t.id))
                        } : p
                    )
                } : w
            );
        }

    },
    extraReducers: (builder) => { 
        builder.addCase(fetchWorkspaces.pending, (state) => {
            state.loading = true
            state.error = null
        });
        builder.addCase(fetchWorkspaces.fulfilled, (state, action) => {
            state.workspaces = action.payload;
            state.currentWorkspace = null; // never carry over a previous account's selection
            if(action.payload.length > 0){
                const localStorageCurrentWorkspaceId = localStorage.getItem('currentWorkspaceId');
                if(localStorageCurrentWorkspaceId){
                    const findWorkspace = action.payload.find((workspace)=> workspace.id === localStorageCurrentWorkspaceId);
                    if(findWorkspace){
                        state.currentWorkspace = findWorkspace
                    }else{
                        state.currentWorkspace = action.payload[0]
                    }
                }else{
                    state.currentWorkspace = action.payload[0]
                }
            }
            state.loading = false
            state.loaded = true
        });
        builder.addCase(fetchWorkspaces.rejected, (state, action) => {
            state.loading = false
            state.loaded = true
            state.error = action.payload || action.error.message
        });
    }
});

export const { setWorkspaces, setCurrentWorkspace, addWorkspace, updateWorkspace, deleteWorkspace, addProject, addTask, updateTask, deleteTask } = workspaceSlice.actions;
export default workspaceSlice.reducer;