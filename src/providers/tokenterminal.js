const axios = require('axios').create({
  baseURL: 'https://api.tokenterminal.com/v1',
  timeout: 180000,
  headers: { Authorization: `Bearer ${process.env.TOKEN_TERMINAL_KEY}` }
})

exports.getProjects = () => {
  return axios.get('/projects?interval=daily')
    .then(({ data }) => data.map(item => {
      return [
        item.project_id,
        item.revenue_30d
      ]
    }))
}
