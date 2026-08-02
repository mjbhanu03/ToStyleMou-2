const joi = require("joi")
const { checkApi, validateJoi, checkToken } = require("../../utils/middleware")
const { homePage, categoryList, categoryPostList, postDetails, addRanking, addRating, createPost, deletePost, saveUnsavePost, addComment, reportPost } = require("../../models/v1/post_model")
const postRoute = require("express").Router()

postRoute.get("/home",checkApi,checkToken,homePage)
postRoute.get("/categoryList",checkApi,checkToken,categoryList)
postRoute.get("/categoryPostList",checkApi,checkToken,categoryPostList)
postRoute.get("/postDetails/:id",checkApi,checkToken,postDetails)
postRoute.post("/addRanking",checkApi,checkToken,validateJoi(
    joi.object({
        "post_id":joi.number().required(),
        "ranking": joi.array()
        .items(
            joi.object({
                m_id: joi.number().required(),
                rank: joi.number().required()
            })).required()
    })
),addRanking)

postRoute.post("/addRating",checkApi,checkToken,validateJoi(
    joi.object({
        "post_id":joi.number().required(),
        "rating": joi.number().required()
    })
),addRating)

postRoute.post("/createPost",checkApi,checkToken,validateJoi(
    joi.object({
        description:joi.string().required(), 
        cat_id:joi.number().required(), 
        post_type:joi.string().required(), 
        ranking_expired_on:joi.date().optional(), 
        media:joi.array()
        .items(
            joi.object({
                media_type: joi.string().required(),
                media_url: joi.string().required()
            })).required()
    })
),createPost)

postRoute.post("/deletePost",checkApi,checkToken,validateJoi(
    joi.object({
        post_id:joi.number().required()
    })
),deletePost)

postRoute.post("/saveUnsavePost",checkApi,checkToken,validateJoi(
    joi.object({
        post_id:joi.number().required()
    })
),saveUnsavePost)

postRoute.post("/addComment",checkApi,checkToken,validateJoi(
    joi.object({
        post_id:joi.number().required(),
        comment_text:joi.string().required()
    })
),addComment)

postRoute.post("/reportPost",checkApi,checkToken,validateJoi(
    joi.object({
        post_id:joi.number().required(),
        report_text:joi.string().required()
    })
),reportPost)

module.exports=postRoute