function standardResponse(response, data, status, message) {
  return response.send({
    data: data,
    status: status,
    message: message,
  });
}
module.exports = { standardResponse };
